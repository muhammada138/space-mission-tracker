import datetime as dt
import logging
import os

logger = logging.getLogger(__name__)

from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Launch
from .serializers import LaunchSerializer
from .services import get_upcoming_launches, get_past_launches, get_launch_by_api_id
from .spacex_service import get_spacex_upcoming_launches, get_spacex_past_launches

# Fallback dates for sorting when launch_date is None
_FAR_FUTURE = dt.datetime(9999, 1, 1, tzinfo=dt.timezone.utc)
_FAR_PAST = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)


def _to_dt(val, fallback):
    """Coerce a value to a datetime for safe sorting."""
    if val is None:
        return fallback
    if isinstance(val, dt.datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=dt.timezone.utc)
        return val
    if isinstance(val, str):
        parsed = parse_datetime(val)
        if parsed:
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=dt.timezone.utc)
            return parsed
    return fallback


def _filter_and_deduplicate(launches, source, seen=None):
    """Helper to filter by source and deduplicate by api_id."""
    if seen is None:
        seen = set()
    
    final = []
    for l in launches:
        api_id = l.get('api_id')
        if api_id not in seen:
            if source == 'spacex':
                # Filter for SpaceX provider
                provider = l.get('launch_provider', '')
                if not (provider and 'SpaceX' in provider):
                    continue
            elif source == 'll2':
                # Filter out SpaceX-prefixed IDs
                if str(api_id or '').startswith('spacex_'):
                    continue
                    
            final.append(l)
            seen.add(api_id)
    return final, seen


class UpcomingLaunchesView(APIView):
    """GET /api/launches/upcoming/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        source = request.query_params.get('source', 'all')
        raw_launches = []
        
        # 1. Fetch from LL2 (via local service)
        # Always fetch LL2 because native SpaceX API is stale for upcoming flights,
        # but LL2 actively tracks SpaceX manifests with correct provider tags.
        if source in ('ll2', 'all', 'spacex'):
            try:
                raw_launches += get_upcoming_launches(limit=100)
            except Exception as e:
                logger.warning(f"Upcoming LL2 fetch failed: {e}")
                
        # 2. Fetch from SpaceX directly
        if source in ('spacex', 'all'):
            try:
                raw_launches += get_spacex_upcoming_launches(limit=100)
            except Exception as e:
                logger.warning(f"Upcoming SpaceX fetch failed: {e}")
                
        # Serialize model objects
        serialized = LaunchSerializer(raw_launches, many=True).data
        
        # Deduplicate and filter
        final_launches, _ = _filter_and_deduplicate(serialized, source)

        # Sort by launch date, None-safe
        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_FUTURE))
        return Response(final_launches)


class PastLaunchesView(APIView):
    """GET /api/launches/past/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        source = request.query_params.get('source', 'all')
        raw_launches = []
        
        # Always fetch LL2 since it has deep history and tracks SpaceX provider well
        if source in ('ll2', 'all', 'spacex'):
            try:
                raw_launches += get_past_launches(limit=100)
            except Exception as e:
                logger.warning(f"Past LL2 fetch failed: {e}")
        
        if source in ('spacex', 'all'):
            try:
                raw_launches += get_spacex_past_launches(limit=100)
            except Exception as e:
                logger.warning(f"Past SpaceX fetch failed: {e}")

        # Serialize model objects to dicts
        serialized = LaunchSerializer(raw_launches, many=True).data

        # Load deep history statically seeded JSON
        history = []
        try:
            history_path = os.path.join(os.path.dirname(__file__), 'history.json')
            if os.path.exists(history_path):
                import json
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load history.json: {e}")

        from django.utils import timezone
        now = timezone.now()

        # Deduplicate and filter primary results
        final_launches, seen = _filter_and_deduplicate(serialized, source)
        
        # Deduplicate and filter history (only past launches)
        past_history = []
        for h in history:
            ldate = _to_dt(h.get('launch_date'), _FAR_PAST)
            if ldate < now:
                past_history.append(h)
        
        history_launches, _ = _filter_and_deduplicate(past_history, source, seen=seen)
        final_launches.extend(history_launches)

        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_PAST), reverse=True)
        return Response(final_launches[:2000])


class ActiveLaunchesView(APIView):
    """GET /api/launches/active/ - missions currently in flight"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .services import _upsert_launches, _parse_launch
        import httpx

        # First check DB cache for in-flight matches.
        # Note: Missions with active spacecraft (but "Success" launch statuses, like Artemis II or Dragon)
        # will not be caught here and will instead fall through to the real-time LL2 query below.
        active = list(Launch.objects.filter(
            status__icontains='in flight'
        ).order_by('-launch_date'))
        
        # We purposely do NOT return early here because we want to also fetch recent success 
        # missions that have currently active spacecraft from the LL2 API.

        # Fetch directly from LL2 with status=6 (In Flight)
        try:
            resp = httpx.get(
                'https://ll.thespacedevs.com/2.2.0/launch/',
                params={'status': 6, 'mode': 'detailed', 'limit': 10},
                timeout=15,
            )
            resp.raise_for_status()
            results = resp.json().get('results', [])
            
            # Dynamically fetch recent launches to find active spacecraft
            # (Launch status is "Success", but Spacecraft is "Active")
            try:
                past_resp = httpx.get(
                    'https://ll.thespacedevs.com/2.2.0/launch/previous/',
                    params={'mode': 'detailed', 'limit': 20},
                    timeout=15,
                )
                if past_resp.status_code == 200:
                    past_data = past_resp.json().get('results', [])
                    for launch in past_data:
                        stage = launch.get('rocket', {}).get('spacecraft_stage', {})
                        # If the spacecraft stage indicates the craft is currently in space, route it as active
                        if stage and stage.get('spacecraft', {}).get('in_space') is True:
                            if not any(r['id'] == launch['id'] for r in results):
                                # Force status to 'In Flight' so frontend treats it as an active mission
                                if 'status' in launch and isinstance(launch['status'], dict):
                                    launch['status']['name'] = 'In Flight'
                                    launch['status']['abbrev'] = 'In Flight'
                                results.append(launch)
            except Exception:
                pass

            # Sort combined results by launch date descending
            results.sort(key=lambda x: x.get('net', ''), reverse=True)

            if results:
                launches = list(_upsert_launches(results))
                # Combine with db cache hits to ensure nothing is lost during transition
                result_ids = {l.api_id for l in launches}
                for a in active:
                    if a.api_id not in result_ids:
                        launches.append(a)
                
                # Sort the combined objects by launch date descending
                launches.sort(key=lambda x: x.launch_date if x.launch_date else x.last_fetched, reverse=True)
                
                return Response(LaunchSerializer(launches, many=True).data)
            elif active:
                return Response(LaunchSerializer(active, many=True).data)
                
        except Exception as e:
            # If API fails, fallback to DB cache if we have anything
            if active:
                return Response(LaunchSerializer(active, many=True).data)
            return Response({'detail': f'Fetch failed: {str(e)}'}, status=503)

        # Fallback: actually no in-flight missions right now
        return Response([])


class LaunchDetailView(APIView):
    """GET /api/launches/<api_id>/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        # Check DB first (works for both SpaceX and LL2 cached data)
        try:
            launch = Launch.objects.get(api_id=api_id)
            return Response(LaunchSerializer(launch).data)
        except Launch.DoesNotExist:
            pass

        # Try fetching from LL2 (SpaceX launches are already prefixed)
        try:
            launch = get_launch_by_api_id(api_id)
            if launch:
                return Response(LaunchSerializer(launch).data)
        except Exception:
            pass

        return Response({'detail': 'Launch not found.'}, status=status.HTTP_404_NOT_FOUND)


class LaunchUpdatesView(APIView):
    """GET /api/launches/<api_id>/updates/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        import httpx
        try:
            # Only LL2 has updates (SpaceX IDs are prefixed with spacex_)
            if api_id.startswith('spacex_'):
                return Response([])
            
            resp = httpx.get(
                'https://ll.thespacedevs.com/2.2.0/update/',
                params={'launch__id': api_id},
                timeout=15,
            )
            resp.raise_for_status()
            return Response(resp.json().get('results', []))
        except Exception:
            return Response([])


class ISSCrewView(APIView):
    """GET /api/iss-crew/ - proxy for detailed LL2 astronaut data with Wikipedia enrichment.
    Uses synchronous httpx so it works under both WSGI and ASGI.
    """
    permission_classes = [permissions.AllowAny]

    _cache = {'data': None, 'expires': None}

    # Hardcoded fallback crew for when ALL external APIs are down
    _FALLBACK_CREW = [
        {'name': 'Sunita Williams', 'craft': 'ISS', 'nationality': 'American', 'agency': {'name': 'NASA', 'abbrev': 'NASA', 'type': 'Government'}, 'bio': 'Sunita "Suni" Williams is a NASA astronaut. She previously held the record for total spacewalks by a woman and has spent over 322 days in space.', 'profile_image': '', 'date_of_birth': '1965-09-19', 'flights_count': 3, 'status': {'name': 'Active'}, 'wiki_url': 'https://en.wikipedia.org/wiki/Sunita_Williams'},
        {'name': 'Butch Wilmore', 'craft': 'ISS', 'nationality': 'American', 'agency': {'name': 'NASA', 'abbrev': 'NASA', 'type': 'Government'}, 'bio': 'Barry "Butch" Wilmore is a NASA astronaut and a United States Navy test pilot. He has logged over 178 days in space.', 'profile_image': '', 'date_of_birth': '1962-06-29', 'flights_count': 3, 'status': {'name': 'Active'}, 'wiki_url': 'https://en.wikipedia.org/wiki/Butch_Wilmore'},
        {'name': 'Oleg Kononenko', 'craft': 'ISS', 'nationality': 'Russian', 'agency': {'name': 'Russian Federal Space Agency', 'abbrev': 'RFSA', 'type': 'Government'}, 'bio': 'Oleg Kononenko is a Russian cosmonaut who holds the record for the most cumulative time spent in space.', 'profile_image': '', 'date_of_birth': '1964-06-21', 'flights_count': 5, 'status': {'name': 'Active'}, 'wiki_url': 'https://en.wikipedia.org/wiki/Oleg_Kononenko'},
        {'name': 'Nikolai Chub', 'craft': 'ISS', 'nationality': 'Russian', 'agency': {'name': 'Russian Federal Space Agency', 'abbrev': 'RFSA', 'type': 'Government'}, 'bio': 'Nikolai Chub is a Russian cosmonaut selected in 2012.', 'profile_image': '', 'date_of_birth': '1984-04-10', 'flights_count': 1, 'status': {'name': 'Active'}, 'wiki_url': 'https://en.wikipedia.org/wiki/Nikolai_Chub'},
        {'name': 'Don Pettit', 'craft': 'ISS', 'nationality': 'American', 'agency': {'name': 'NASA', 'abbrev': 'NASA', 'type': 'Government'}, 'bio': 'Donald Roy Pettit is an American chemical engineer and NASA astronaut known for his creative experiments aboard the ISS.', 'profile_image': '', 'date_of_birth': '1955-04-20', 'flights_count': 4, 'status': {'name': 'Active'}, 'wiki_url': 'https://en.wikipedia.org/wiki/Don_Pettit'},
    ]

    @staticmethod
    def _get_wiki_summary_sync(client, name):
        """Fetch a rich Wikipedia extract and high-res photo for an astronaut (sync)."""
        import urllib.parse
        try:
            slug = urllib.parse.quote(name.replace(' ', '_'))
            resp = client.get(
                f'https://en.wikipedia.org/api/rest_v1/page/summary/{slug}',
                timeout=6,
                headers={'User-Agent': 'SpaceTracker/1.0'},
            )

            wiki_data = {'wiki_extract': '', 'wiki_thumbnail': '', 'wiki_url': ''}

            if resp.status_code == 200:
                data = resp.json()
                wiki_data['wiki_thumbnail'] = data.get('originalimage', {}).get('source', '') or \
                                             data.get('thumbnail', {}).get('source', '')
                wiki_data['wiki_url'] = data.get('content_urls', {}).get('desktop', {}).get('page', '')
                wiki_data['wiki_extract'] = data.get('extract', '')

            # Full intro via Action API
            action_resp = client.get(
                'https://en.wikipedia.org/w/api.php',
                params={
                    'action': 'query', 'format': 'json', 'prop': 'extracts',
                    'exintro': True, 'explaintext': True, 'titles': name, 'redirects': 1,
                },
                timeout=6,
                headers={'User-Agent': 'SpaceTracker/1.0'},
            )
            if action_resp.status_code == 200:
                pages = action_resp.json().get('query', {}).get('pages', {})
                for page_id in pages:
                    full_intro = pages[page_id].get('extract', '')
                    if full_intro and len(full_intro) > len(wiki_data['wiki_extract']):
                        wiki_data['wiki_extract'] = full_intro

            return wiki_data
        except Exception:
            return {}

    def get(self, request):
        import httpx
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from django.utils import timezone

        now = timezone.now()

        # Return cached response if still fresh
        if self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
            return Response(self._cache['data'])

        with httpx.Client(timeout=15) as client:
            crew = []
            source = 'unavailable'

            # --- Attempt 1: LL2 detailed astronaut API ---
            try:
                resp = client.get(
                    'https://ll.thespacedevs.com/2.2.0/astronaut/',
                    params={'in_space': 'true', 'mode': 'detailed', 'limit': 30},
                )
                resp.raise_for_status()
                results = resp.json().get('results', [])

                for a in results:
                    entry = {
                        'name': a.get('name', ''),
                        'nationality': a.get('nationality', ''),
                        'bio': a.get('bio', ''),
                        'profile_image': a.get('profile_image') or a.get('profile_image_thumbnail') or '',
                        'date_of_birth': a.get('date_of_birth', ''),
                        'flights_count': a.get('flights_count', 0),
                        'agency': {
                            'name': (a.get('agency') or {}).get('name', ''),
                            'abbrev': (a.get('agency') or {}).get('abbrev', ''),
                            'type': (a.get('agency') or {}).get('type', ''),
                        },
                        'status': {'name': (a.get('status') or {}).get('name', 'Active')},
                        'wiki_url': a.get('wiki', ''),
                    }
                    craft = 'ISS'
                    try:
                        last_flight = (a.get('last_flight') or '')
                        if 'shenzhou' in last_flight.lower() or 'tiangong' in last_flight.lower():
                            craft = 'Tiangong'
                        for f in (a.get('flights', []) or []):
                            if 'shenzhou' in (f.get('name') or '').lower():
                                craft = 'Tiangong'
                                break
                    except Exception:
                        pass
                    entry['craft'] = craft
                    crew.append(entry)

                source = 'll2'
                logger.info(f'LL2 astronaut API returned {len(crew)} crew members')

            except Exception as e:
                logger.warning(f'LL2 astronaut fetch failed: {e}')

                # --- Attempt 2: Open-Notify fallback ---
                try:
                    resp = client.get('http://api.open-notify.org/astros.json', timeout=10)
                    resp.raise_for_status()
                    people = resp.json().get('people', [])
                    for p in people:
                        crew.append({
                            'name': p.get('name', ''),
                            'craft': p.get('craft', 'ISS'),
                            'nationality': '', 'bio': '', 'profile_image': '',
                            'date_of_birth': '', 'flights_count': None,
                            'agency': {'name': '', 'abbrev': '', 'type': ''},
                            'status': {'name': 'Active'}, 'wiki_url': '',
                        })
                    source = 'open-notify'
                    logger.info(f'Open-Notify fallback returned {len(crew)} people')
                except Exception as e2:
                    logger.warning(f'Open-Notify fallback also failed: {e2}')

            # --- Attempt 3: Hardcoded fallback ---
            if not crew:
                import copy
                crew = copy.deepcopy(self._FALLBACK_CREW)
                source = 'fallback'
                logger.info('Using hardcoded fallback crew data')

            # --- Enrich with Wikipedia data using thread pool ---
            try:
                def _enrich(entry_and_client):
                    entry, wiki_client = entry_and_client
                    wiki = self._get_wiki_summary_sync(wiki_client, entry['name'])
                    return (entry, wiki)

                with httpx.Client(timeout=8) as wiki_client:
                    with ThreadPoolExecutor(max_workers=6) as pool:
                        futures = [pool.submit(_enrich, (e, wiki_client)) for e in crew]
                        for future in as_completed(futures):
                            try:
                                entry, wiki = future.result()
                                if wiki:
                                    if wiki.get('wiki_thumbnail'):
                                        entry['profile_image'] = wiki['wiki_thumbnail']
                                    if wiki.get('wiki_extract') and len(wiki['wiki_extract']) > len(entry.get('bio', '')):
                                        entry['bio'] = wiki['wiki_extract']
                                    if wiki.get('wiki_url'):
                                        entry['wiki_url'] = wiki['wiki_url']
                            except Exception:
                                pass
            except Exception as e:
                logger.warning(f'Wikipedia enrichment failed: {e}')

            result = {'crew': crew, 'count': len(crew), 'source': source}
            ttl = dt.timedelta(hours=2) if source == 'll2' else dt.timedelta(minutes=30)
            ISSCrewView._cache = {'data': result, 'expires': now + ttl}
            return Response(result)


class LaunchPadWeatherView(APIView):
    """GET /api/launches/<api_id>/pad-weather/ - current weather at the launch pad"""
    permission_classes = [permissions.AllowAny]

    # Simple in-memory cache: {api_id: (expires, data)}
    _cache: dict = {}

    def get(self, request, api_id):
        import httpx, os
        from django.utils import timezone

        now = timezone.now()

        # Return cached response if fresh (15 min TTL)
        cached = self._cache.get(api_id)
        if cached and now < cached[0]:
            return Response(cached[1])

        try:
            launch = Launch.objects.get(api_id=api_id)
        except Launch.DoesNotExist:
            return Response({'detail': 'Launch not found.'}, status=404)

        lat = launch.pad_latitude
        lon = launch.pad_longitude
        if lat is None or lon is None:
            return Response({'detail': 'No coordinates for this pad.'}, status=404)

        api_key = os.environ.get('OPENWEATHERMAP_API_KEY', '')
        
        try:
            if api_key:
                resp = httpx.get(
                    'https://api.openweathermap.org/data/2.5/weather',
                    params={'lat': lat, 'lon': lon, 'units': 'metric', 'appid': api_key},
                    timeout=10,
                )
                resp.raise_for_status()
                raw = resp.json()

                wind_mps = raw.get('wind', {}).get('speed', 0)
                wind_knots = wind_mps * 1.94384
                visibility_m = raw.get('visibility', 10000)
                visibility_mi = visibility_m / 1609.34
                temp_c = raw.get('main', {}).get('temp', 20)
                humidity = raw.get('main', {}).get('humidity', 50)
                description = raw.get('weather', [{}])[0].get('description', 'clear').title()
                icon = raw.get('weather', [{}])[0].get('icon', '01d')
                thunderstorm = any(w.get('main', '').lower() == 'thunderstorm' for w in raw.get('weather', []))
            else:
                # Fallback: Open-Meteo (No key required)
                resp = httpx.get(
                    'https://api.open-meteo.com/v1/forecast',
                    params={'latitude': lat, 'longitude': lon, 'current_weather': True},
                    timeout=10,
                )
                resp.raise_for_status()
                current = resp.json().get('current_weather', {})
                temp_c = current.get('temperature', 20)
                wind_kmh = current.get('windspeed', 0)
                wind_knots = wind_kmh * 0.539957
                weather_code = current.get('weathercode', 0)
                
                descriptions = {
                    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
                    45: 'Fog', 48: 'Fog', 51: 'Light Drizzle', 61: 'Slight Rain', 63: 'Moderate Rain',
                    80: 'Rain Showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
                }
                description = descriptions.get(weather_code, 'Cloudy')
                icon = '01d' if weather_code == 0 else '02d'
                visibility_mi = 10.0 # Open-Meteo basic free tier doesn't give visibility in current_weather
                humidity = 50 # Or fetch more params if needed, but keeping it simple
                thunderstorm = weather_code >= 95

            # Go/No-Go rules (simplified NASA flight rules)
            rules = [
                {'name': 'Wind Speed', 'value': f'{wind_knots:.1f} kts', 'go': wind_knots < 30, 'limit': '< 30 kts'},
                {'name': 'Visibility', 'value': f'{visibility_mi:.1f} mi', 'go': visibility_mi >= 5, 'limit': '≥ 5 mi'},
                {'name': 'Thunderstorm', 'value': 'Clear' if not thunderstorm else 'Active', 'go': not thunderstorm, 'limit': 'None within 10 mi'},
                {'name': 'Temperature', 'value': f'{temp_c:.0f}°C', 'go': -20 <= temp_c <= 45, 'limit': '-20°C to 45°C'},
                {'name': 'Humidity', 'value': f'{humidity}%', 'go': humidity < 90, 'limit': '< 90%'},
            ]

            go_count = sum(1 for r in rules if r['go'])
            overall = 'GO' if go_count == len(rules) else ('HOLD' if go_count < len(rules) - 1 else 'MARGINAL')

            data = {
                'available': True,
                'description': description,
                'icon': icon,
                'wind_knots': round(wind_knots, 1),
                'visibility_mi': round(visibility_mi, 1),
                'temp_c': round(temp_c, 1),
                'humidity': humidity,
                'rules': rules,
                'overall': overall,
                'go_count': go_count,
                'total_rules': len(rules),
                'source': 'OpenWeatherMap' if api_key else 'Open-Meteo'
            }

            LaunchPadWeatherView._cache[api_id] = (now + dt.timedelta(minutes=15), data)
            return Response(data)

        except Exception as e:
            return Response({'available': False, 'reason': str(e)}, status=503)


class SpaceWeatherView(APIView):
    """GET /api/space-weather/ - current space weather from NASA DONKI"""
    permission_classes = [permissions.AllowAny]

    _cache = {'data': None, 'expires': None}

    def get(self, request):
        import httpx
        from django.utils import timezone

        now = timezone.now()

        # Check cache (1 hour TTL)
        if self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
            return Response(self._cache['data'])

        try:
            api_key = os.environ.get('NASA_API_KEY', 'DEMO_KEY')
            today = now.strftime('%Y-%m-%d')
            week_ago = (now - dt.timedelta(days=7)).strftime('%Y-%m-%d')

            # Fetch recent solar flares
            flr_resp = httpx.get(
                'https://api.nasa.gov/DONKI/FLR',
                params={'startDate': week_ago, 'endDate': today, 'api_key': api_key},
                timeout=10,
            )
            flares = flr_resp.json() if flr_resp.status_code == 200 else []
            if not isinstance(flares, list):
                flares = []

            # Fetch geomagnetic storms
            gst_resp = httpx.get(
                'https://api.nasa.gov/DONKI/GST',
                params={'startDate': week_ago, 'endDate': today, 'api_key': api_key},
                timeout=10,
            )
            storms = gst_resp.json() if gst_resp.status_code == 200 else []
            if not isinstance(storms, list):
                storms = []

            # Determine Kp index from storms
            kp = 0
            if storms:
                for s in storms:
                    for obs in s.get('allKpIndex', []):
                        kp = max(kp, obs.get('kpIndex', 0))

            # Determine severity level
            if kp >= 7 or len(flares) > 5:
                level = 'severe'
                label = 'Storm Active'
            elif kp >= 4 or len(flares) > 2:
                level = 'moderate'
                label = 'Moderate Activity'
            else:
                level = 'nominal'
                label = 'Quiet'

            result = {
                'level': level,
                'label': label,
                'kp': kp,
                'flares': len(flares),
                'storms': len(storms),
            }

            # Cache for 1 hour
            SpaceWeatherView._cache = {
                'data': result,
                'expires': now + dt.timedelta(hours=1),
            }

            return Response(result)

        except Exception:
            # Return nominal fallback on any error
            return Response({
                'level': 'nominal',
                'label': 'Data Unavailable',
                'kp': 0,
                'flares': 0,
                'storms': 0,
            })
