import datetime as dt

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


class UpcomingLaunchesView(APIView):
    """GET /api/launches/upcoming/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        source = request.query_params.get('source', 'all')
        launches = []
        
        # Always fetch from both to ensure we have all data (SpaceX API is dead but keeping logic)
        if source in ('ll2', 'spacex', 'all'):
            try:
                launches += get_upcoming_launches(limit=100)
            except Exception:
                pass
                
        if source in ('spacex', 'all'):
            try:
                launches += get_spacex_upcoming_launches(limit=100)
            except Exception:
                pass
                
        # Serialize model objects
        serialized = LaunchSerializer(launches, many=True).data
        
        # Deduplicate
        seen = set()
        final_launches = []
        for l in serialized:
            if l.get('api_id') not in seen:
                final_launches.append(l)
                seen.add(l.get('api_id'))
                
        # Apply source filter in python
        if source == 'spacex':
            final_launches = [l for l in final_launches if l.get('launch_provider') and 'SpaceX' in l.get('launch_provider')]
        elif source == 'll2':
            final_launches = [l for l in final_launches if not str(l.get('api_id', '')).startswith('spacex_')]

        # Sort by launch date, None-safe
        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_FUTURE))
        return Response(final_launches)


class PastLaunchesView(APIView):
    """GET /api/launches/past/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        source = request.query_params.get('source', 'all')
        launches = []
        if source in ('ll2', 'spacex', 'all'):
            try:
                launches += get_past_launches(limit=100)
            except Exception:
                pass
        if source in ('spacex', 'all'):
            try:
                launches += get_spacex_past_launches(limit=100)
            except Exception:
                pass

        # Serialize model objects to dicts
        serialized_launches = LaunchSerializer(launches, many=True).data

        # Load deep history statically seeded JSON
        history = []
        try:
            import json, os
            history_path = os.path.join(os.path.dirname(__file__), 'history.json')
            if os.path.exists(history_path):
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
        except Exception:
            pass

        import datetime as dt
        from django.utils import timezone
        now = timezone.now()

        # De-duplicate by api_id and filter by date/source
        seen = set()
        final_launches = []
        
        # Filter serialized launches
        for l in serialized_launches:
            if l.get('api_id') not in seen:
                if source == 'spacex':
                    if not (l.get('launch_provider') and 'SpaceX' in l.get('launch_provider')):
                        continue
                elif source == 'll2':
                    if str(l.get('api_id', '')).startswith('spacex_'):
                        continue
                        
                final_launches.append(l)
                seen.add(l.get('api_id'))
                
        # Filter history
        for l in history:
            if l.get('api_id') not in seen:
                # 1. Filter out FUTURE launches
                ldate = _to_dt(l.get('launch_date'), _FAR_PAST)
                if ldate >= now:
                    continue
                    
                # 2. Filter by source
                if source == 'spacex':
                    if not (l.get('launch_provider') and 'SpaceX' in l.get('launch_provider')):
                        continue
                elif source == 'll2':
                    if str(l.get('api_id', '')).startswith('spacex_'):
                        continue
                        
                final_launches.append(l)
                seen.add(l.get('api_id'))

        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_PAST), reverse=True)
        return Response(final_launches[:2000]) # Cap to ensure we don't blow up browser memory in worst case


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
                        # status ID 1 means spacecraft is currently active.
                        if stage and stage.get('spacecraft', {}).get('status', {}).get('id') == 1:
                            if not any(r['id'] == launch['id'] for r in results):
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
    """GET /api/iss-crew/ - proxy for detailed LL2 astronaut data with Open-Notify fallback"""
    permission_classes = [permissions.AllowAny]

    _cache = {'data': None, 'expires': None}

    def get(self, request):
        import httpx
        from django.utils import timezone

        now = timezone.now()

        if self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
            return Response(self._cache['data'])

        try:
            # Fetch detailed astronaut data from LL2 and cache it heavily to avoid rate limits
            resp = httpx.get('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&mode=detailed', timeout=15)
            resp.raise_for_status()
            data = resp.json()
            crew = data.get('results', [])
            result = {'crew': crew}
            
            ISSCrewView._cache = {'data': result, 'expires': now + dt.timedelta(hours=2)}
            return Response(result)
            
        except Exception:
            try:
                resp = httpx.get('http://api.open-notify.org/astros.json', timeout=10)
                resp.raise_for_status()
                data = resp.json()
                crew = [p for p in data.get('people', []) if p.get('craft') == 'ISS']
                result = {'crew': crew}
    
                ISSCrewView._cache = {'data': result, 'expires': now + dt.timedelta(minutes=15)}
                return Response(result)
                
            except Exception:
                return Response({'crew': []}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


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
        if not api_key:
            # Return placeholder when key not configured
            return Response({
                'available': False,
                'reason': 'Weather API key not configured.',
            })

        try:
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
            description = raw.get('weather', [{}])[0].get('description', 'clear')
            icon = raw.get('weather', [{}])[0].get('icon', '01d')
            thunderstorm = any(
                w.get('main', '').lower() == 'thunderstorm'
                for w in raw.get('weather', [])
            )

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
                'description': description.title(),
                'icon': icon,
                'wind_knots': round(wind_knots, 1),
                'visibility_mi': round(visibility_mi, 1),
                'temp_c': round(temp_c, 1),
                'humidity': humidity,
                'rules': rules,
                'overall': overall,
                'go_count': go_count,
                'total_rules': len(rules),
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
            api_key = 'DEMO_KEY'  # NASA DEMO_KEY works for low rate
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
