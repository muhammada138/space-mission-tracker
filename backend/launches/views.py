import datetime as dt
import logging
import os

logger = logging.getLogger(__name__)

from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Launch
from .serializers import LaunchSerializer, BriefLaunchSerializer
from .services import get_upcoming_launches, get_past_launches, get_launch_by_api_id
from .spacex_service import get_spacex_upcoming_launches, get_spacex_past_launches
import httpx
import json
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.utils import timezone
from datetime import timedelta

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
    """Helper to filter by source and deduplicate by api_id AND mission name."""
    if seen is None:
        seen = set()

    final = []
    seen_names: set[str] = set()  # Secondary dedup — prevents same mission showing twice
    for l in launches:
        api_id = l.get('api_id')
        name_key = (l.get('name') or '').lower().strip()
        if api_id not in seen and name_key not in seen_names:
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
            if name_key:
                seen_names.add(name_key)
    return final, seen


def _filter_by_name_collision(past_launches, upcoming_launches):
    """
    Remove launches from the past list if a mission with the same name
    exists in the upcoming list (handling reschedules/stale records).
    """
    upcoming_names = {l.get('name', '').lower() for l in upcoming_launches}
    return [l for l in past_launches if l.get('name', '').lower() not in upcoming_names]


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
        serialized = BriefLaunchSerializer(raw_launches, many=True).data
        
        # Deduplicate and filter, and ENSURE only upcoming dates are shown
        final_launches, _ = _filter_and_deduplicate(serialized, source)
        now = timezone.now()
        final_launches = [l for l in final_launches if _to_dt(l.get('launch_date'), _FAR_PAST) >= now]

        # Sort by launch date, None-safe
        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_FUTURE))
        return Response(final_launches)


class PastLaunchesView(APIView):
    """GET /api/launches/past/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    _cache = {} # {source: (expires, data)}

    def get(self, request):
        source = request.query_params.get('source', 'all')
        now = timezone.now()

        # 1. Return memory cache if still fresh (1 hour TTL for past data)
        cached = self._cache.get(source)
        if cached and now < cached[0]:
            return Response(cached[1])

        raw_launches = []
        
        # Always fetch LL2 since it has deep history and tracks SpaceX provider well
        if source in ('ll2', 'all', 'spacex'):
            try:
                raw_launches += get_past_launches(limit=100)
            except Exception as e:
                logger.warning(f"Past LL2 fetch failed: {e}")
        
        if source in ('spacex', 'all'):
            try:
                # Use a smaller limit for SpaceX past to avoid timeouts
                raw_launches += get_spacex_past_launches(limit=40)
            except Exception as e:
                logger.warning(f"Past SpaceX fetch failed: {e}")

        # Serialize model objects to dicts
        serialized = BriefLaunchSerializer(raw_launches, many=True).data

        # Load deep history statically seeded JSON
        history = []
        try:
            history_path = os.path.join(os.path.dirname(__file__), 'history.json')
            if os.path.exists(history_path):
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load history.json: {e}")

        # Deduplicate and filter primary results, and ENSURE only past dates are shown
        final_launches, seen = _filter_and_deduplicate(serialized, source)
        final_launches = [l for l in final_launches if _to_dt(l.get('launch_date'), _FAR_FUTURE) < now]
        
        # Deduplicate and filter history (only past launches)
        past_history = []
        for h in history:
            ldate = _to_dt(h.get('launch_date'), _FAR_PAST)
            # Only add to history if it's actually in the past AND not in our fresh results
            if ldate < now:
                # Enrichment for orbital filtering
                name = h.get('name', '')
                if 'Starlink' in name:
                    h['mission_type'] = 'Communications'
                    h['orbit'] = 'Low Earth Orbit'
                elif 'Jilin-1' in name:
                    h['mission_type'] = 'Earth Science'
                    h['orbit'] = 'Sun-Synchronous Orbit'
                elif 'OneWeb' in name:
                    h['mission_type'] = 'Communications'
                    h['orbit'] = 'Low Earth Orbit'
                elif 'Galileo' in name:
                    h['mission_type'] = 'Navigation'
                    h['orbit'] = 'Medium Earth Orbit'
                
                past_history.append(h)
        
        history_launches, _ = _filter_and_deduplicate(past_history, source, seen=seen)
        final_launches.extend(history_launches)

        final_launches.sort(key=lambda l: _to_dt(l.get('launch_date'), _FAR_PAST), reverse=True)
        final_data = final_launches[:2000]

        # Smart Suppression: Hide "Past" records if the mission is actually rescheduled for the future
        # (prevents same mission appearing twice if LL2 hasn't cleaned up the old scheduled record)
        try:
            upcoming_names = set(
                Launch.objects.filter(launch_date__gt=now)
                .values_list('name', flat=True)
            )
            # Only suppress if the 'past' record is more than 6 hours old (prevents hiding actual recent flights)
            suppress_cutoff = now - timedelta(hours=6)
            final_data = [
                l for l in final_data
                if l.get('name') not in upcoming_names or _to_dt(l.get('launch_date'), _FAR_PAST) > suppress_cutoff
            ]
        except Exception:
            pass

        # Update cache (1 hour TTL)
        if final_data:
            self._cache[source] = (now + timedelta(hours=1), final_data)

        return Response(final_data)


class ActiveLaunchesView(APIView):
    """GET /api/launches/active/ - missions currently in flight"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):

        # First check DB cache for in-flight matches.
        # Note: Missions with active spacecraft (but "Success" launch statuses, like Artemis II or Dragon)
        # will not be caught here and will instead fall through to the real-time LL2 query below.
        now = timezone.now()
        raw_active = list(Launch.objects.filter(
            status__icontains='in flight'
        ).order_by('-launch_date'))
        
        active = []
        for l in raw_active:
            ldate = _to_dt(l.launch_date, _FAR_PAST)
            # 24h safety cutoff for "In Flight" status
            if ldate != _FAR_PAST and ldate < (now - timedelta(hours=24)):
                # Hard cutoff: missions older than 48h are long-duration/payload missions.
                # They belong in the Payloads tab, not Currently Active.
                if ldate < (now - timedelta(hours=48)):
                    continue
                # If between 24-48h old, try to refresh once to confirm it's over
                try:
                    refreshed = get_launch_by_api_id(l.api_id, force_refresh=True)
                    if refreshed and 'in flight' in (refreshed.status or '').lower():
                        active.append(refreshed)
                except Exception:
                    pass
            else:
                active.append(l)

        # We purposely do NOT return early here because we want to also fetch recent success 
        # missions that have currently active spacecraft from the LL2 API.

        # Fetch directly from LL2 with status=6 (In Flight)
        try:
            resp = httpx.get(
                'https://ll.thespacedevs.com/2.2.0/launch/',
                params={'status': 6, 'mode': 'detailed', 'limit': 10},
                timeout=15,
            )
            if resp.status_code == 200:
                results = resp.json().get('results', [])
            else:
                results = []
            
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
                    existing_ids = {r['id'] for r in results if 'id' in r}
                    # Only include spacecraft-in-space missions launched within the last 3 days.
                    # Older missions (like Cygnus resupply) belong in the Payloads tab.
                    in_space_cutoff = now - timedelta(days=3)
                    for launch in past_data:
                        stage = launch.get('rocket', {}).get('spacecraft_stage', {})
                        ldate_check = _to_dt(launch.get('net'), _FAR_PAST)
                        # If the spacecraft stage indicates the craft is currently in space, route it as active
                        if (stage and stage.get('spacecraft', {}).get('in_space') is True
                                and ldate_check >= in_space_cutoff):
                            if 'id' in launch and launch['id'] not in existing_ids:
                                # Force status to 'In Flight' so frontend treats it as an active mission
                                if 'status' in launch and isinstance(launch['status'], dict):
                                    launch['status']['name'] = 'In Flight'
                                    launch['status']['abbrev'] = 'In Flight'
                                results.append(launch)
                                existing_ids.add(launch['id'])
            except Exception:
                pass

            now = timezone.now()

            # --- Bridge the LL2 "Status 6" gap ---
            # Fetch missions from the last 3 hours and force them to 'Active' 
            # while they climb to orbit, even if LL2 hasn't flagged them status 6 yet.
            recent_cutoff = now - timedelta(hours=3)
            recent_successes_raw = Launch.objects.all()
            recent_successes = []
            for l in recent_successes_raw:
                if 'fail' in (l.status or '').lower(): continue
                ldate = _to_dt(l.launch_date, _FAR_PAST)
                if ldate != _FAR_PAST and recent_cutoff <= ldate <= now:
                    recent_successes.append(l)

            # Pre-extract existing result IDs into a set for O(1) lookup.
            # This avoids an O(N*M) nested loop when iterating over recent_successes below.
            existing_result_ids: set[str] = set()
            for r in results:
                try:
                    rid = r.get('id') if isinstance(r, dict) else (getattr(r, 'id', None) if not hasattr(r, '__getitem__') else r['id'])
                    existing_result_ids.add(str(rid))
                except Exception:
                    pass

            for l in recent_successes:
                # Ensure we don't duplicate missions already in 'results'
                api_id_str = str(l.api_id)
                if api_id_str not in existing_result_ids:
                    # Convert model back to a dict mimicking LL2 results for _upsert
                    results.append({
                        'id': l.api_id,
                        'name': l.name,
                        'net': l.launch_date.isoformat(),
                        'status': {'name': 'In Flight', 'abbrev': 'In Flight'}, # Force active
                        'rocket': {'configuration': {'name': l.rocket}},
                        'launch_service_provider': {'name': l.launch_provider},
                    })
                    existing_result_ids.add(api_id_str)

            # Transition to active 5 minutes before scheduled launch
            active_threshold = now + timedelta(minutes=5)
            results = [r for r in results if _to_dt(r.get('net') if isinstance(r, dict) else getattr(r, 'net', None), _FAR_FUTURE) <= active_threshold]

            # Exclude missions launched more than 48h ago — those are long-duration missions
            # (e.g. Cygnus resupply, Dragon crew) that belong in the "In Orbit" tab.
            active_floor = now - timedelta(hours=48)
            results = [r for r in results
                       if _to_dt(r.get('net') if isinstance(r, dict) else getattr(r, 'net', None), _FAR_PAST) >= active_floor]

            if results:
                # Use local import for services to avoid circular dependency
                from .services import _upsert_launches
                launches = list(_upsert_launches(results))
                
                # --- Post-Upsert Status Enforcement ---
                # Ensure missions we manually identified as 'active' keep their 
                # status flag in the final response objects.
                for l in launches:
                    ldate = _to_dt(l.launch_date, _FAR_PAST)
                    if ldate != _FAR_PAST and (now - timedelta(hours=3)) <= ldate <= (now + timedelta(minutes=5)):
                        # If it's a known success/fail, don't overwrite it unless it's very recent
                        if 'Success' not in (l.status or '') and 'Fail' not in (l.status or ''):
                            l.status = 'In Flight'

                # Combine with db cache hits to ensure nothing is lost during transition
                result_ids = {l.api_id for l in launches}
                for a in active:
                    if a.api_id not in result_ids:
                        launches.append(a)
                
                # Sort the combined objects by launch date descending
                launches.sort(key=lambda x: x.launch_date if x.launch_date else x.last_fetched, reverse=True)
                
                return Response(BriefLaunchSerializer(launches, many=True).data)
            elif active:
                return Response(BriefLaunchSerializer(active, many=True).data)
                
            # Transitions...
            return Response([])
        except Exception as e:
            logger.error(f"Critical error in ActiveLaunchesView: {e}", exc_info=True)
            if active:
                return Response(BriefLaunchSerializer(active, many=True).data)
            return Response([], status=200) # Graceful empty


class PayloadsInOrbitView(APIView):
    """GET /api/launches/payloads/ - spacecraft currently in orbit (long-duration missions)."""
    permission_classes = [permissions.AllowAny]
    _cache = {'data': None, 'expires': None}

    def get(self, request):
        now = timezone.now()
        if self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
            return Response(self._cache['data'])

        # Categories for satellite/payload detection
        valid_types = (
            'planetary science', 'astrophysics', 'heliophysics', 
            'human exploration', 'resupply', 'communications', 
            'navigation', 'earth science', 'technology demonstration',
            'technology', 'test flight', 'dedicated rideshare',
            'multi-payload', 'remote sensing', 'government/top secret',
            'scientific'
        )
        two_years_ago = now - timedelta(days=730)

        # 1. Start with local DB - these are launches we already know about
        # Only include successful launches in the past
        q_types = [t.title() for t in valid_types] + [t.lower() for t in valid_types]
        db_launches = Launch.objects.filter(
            launch_date__lt=now,
            launch_date__gte=two_years_ago,
            status__icontains='Success',
            mission_type__in=q_types
        ).order_by('-launch_date')
        
        payloads_map = {l.api_id: l for l in db_launches}

        # 2. Add history.json data (enriched and filtered for past successes)
        history = []
        try:
            history_path = os.path.join(os.path.dirname(__file__), 'history.json')
            if os.path.exists(history_path):
                with open(history_path, 'r', encoding='utf-8') as f:
                    history_data = json.load(f)
                    for h in history_data:
                        ldate = _to_dt(h.get('launch_date'), _FAR_PAST)
                        # ONLY past, successful, within 2 years
                        if ldate < now and ldate >= two_years_ago and 'Success' in (h.get('status') or ''):
                            name = h.get('name', '')
                            # Basic classification for history items that lack it
                            mtype = h.get('mission_type', '')
                            if not mtype:
                                if 'Starlink' in name: mtype = 'Communications'
                                elif 'Jilin-1' in name: mtype = 'Earth Science'
                                elif 'OneWeb' in name: mtype = 'Communications'
                                elif 'Galileo' in name: mtype = 'Navigation'
                            
                            if mtype.lower() in valid_types:
                                aid = h.get('api_id')
                                if aid and aid not in payloads_map:
                                    # Convert dict to something Serializer can handle if needed
                                    # but LaunchSerializer handles dicts too if they match fields
                                    payloads_map[aid] = h
        except Exception as e:
            logger.error(f"Failed to load history in PayloadsInOrbitView: {e}")

        # 3. Try to fetch fresh data from API to find new things
        try:
            resp = httpx.get(
                'https://ll.thespacedevs.com/2.2.0/launch/previous/',
                params={'mode': 'detailed', 'limit': 100},
                timeout=15,
            )
            
            if resp.status_code == 200:
                api_data = resp.json().get('results', [])
                new_payloads = []
                for launch in api_data:
                    # Only successful launches
                    if launch.get('status', {}).get('abbrev') != 'Success':
                        continue

                    # Logic to identify spacecraft
                    stage = launch.get('rocket', {}).get('spacecraft_stage', {})
                    is_sc = False
                    if stage and isinstance(stage, dict):
                        sc = stage.get('spacecraft', {})
                        if sc and isinstance(sc, dict) and sc.get('in_space') is True:
                            is_sc = True
                    
                    mission = launch.get('mission') or {}
                    mtype = ''
                    if isinstance(mission, dict):
                        mtype = str(mission.get('type') or '')
                    
                    if not is_sc and mtype.lower() in valid_types:
                        ldate = _to_dt(launch.get('net'), _FAR_PAST)
                        if ldate != _FAR_PAST and (now - ldate) < timedelta(days=730):
                            is_sc = True

                    if is_sc:
                        new_payloads.append(launch)

                if new_payloads:
                    from .services import _upsert_launches
                    upserted = _upsert_launches(new_payloads)
                    for l in upserted:
                        payloads_map[l.api_id] = l

            # Sort combined results
            all_payloads = list(payloads_map.values())
            
            def sort_key(x):
                d = getattr(x, 'launch_date', None) if hasattr(x, 'launch_date') else x.get('launch_date')
                return _to_dt(d, _FAR_PAST)

            all_payloads.sort(key=sort_key, reverse=True)
            
            final_data = BriefLaunchSerializer(all_payloads, many=True).data
            
            if final_data:
                self._cache = {
                    'data': final_data,
                    'expires': now + timedelta(hours=24)
                }
            return Response(final_data)

        except Exception as e:
            logger.error(f"Error in PayloadsInOrbitView: {e}", exc_info=True)
            # If API fails, return what we have in DB
            all_payloads = list(payloads_map.values())
            all_payloads.sort(key=lambda x: x.launch_date if x.launch_date else x.last_fetched, reverse=True)
            return Response(BriefLaunchSerializer(all_payloads, many=True).data)


class LaunchDetailView(APIView):
    """GET /api/launches/<api_id>/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        now = timezone.now()

        # Check DB first 
        try:
            launch = Launch.objects.get(api_id=api_id)
            
            # If SpaceX launch is missing landing pad, force a refresh once
            if api_id.startswith('spacex_') and not launch.landing_pad:
                from .spacex_service import get_spacex_launch_by_id
                refreshed = get_spacex_launch_by_id(api_id)
                if refreshed:
                    launch = refreshed
            
            # If the mission is live/recent and missing a webcast, force a refresh from the API
            now = timezone.now()
            ldate = _to_dt(launch.launch_date, _FAR_PAST)
            is_active_window = ldate != _FAR_PAST and (now - timedelta(hours=6)) <= ldate <= (now + timedelta(minutes=15))
            # Also refresh if launched within last 7 days with a non-terminal status
            # (e.g. "To Be Confirmed" missions that haven't been updated since launch)
            is_recent_nonterminal = (
                ldate != _FAR_PAST and ldate < now and
                (now - ldate) < timedelta(days=7) and
                'success' not in (launch.status or '').lower() and
                'fail' not in (launch.status or '').lower()
            )
            if (is_active_window and not launch.webcast_url) or is_recent_nonterminal:
                refreshed = get_launch_by_api_id(api_id, force_refresh=True)
                if refreshed:
                    launch = refreshed
            
            # Force status to In Flight if in the immediate post-launch window
            if ldate != _FAR_PAST and (now - timedelta(hours=3)) <= ldate <= now:
                if 'fail' not in (launch.status or '').lower():
                    launch.status = 'In Flight'
            
            return Response(LaunchSerializer(launch).data)
        except Launch.DoesNotExist:
            pass

        # Try fetching from LL2 
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


    @staticmethod
    def _get_wiki_summary_sync(client, name):
        """Helper to fetch Wikipedia summary synchronously with disambiguation checks"""
        
        def _fetch(title):
            try:
                slug = urllib.parse.quote(title.replace(' ', '_'))
                resp = client.get(
                    f'https://en.wikipedia.org/api/rest_v1/page/summary/{slug}',
                    timeout=6,
                    headers={'User-Agent': 'SpaceTracker/1.0'},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    extract = data.get('extract', '')
                    # If it's a disambiguation page, return None
                    if 'may refer to:' in extract.lower() or 'can refer to:' in extract.lower() or data.get('type') == 'disambiguation':
                        return None
                    return {
                        'wiki_thumbnail': data.get('originalimage', {}).get('source', '') or data.get('thumbnail', {}).get('source', ''),
                        'wiki_url': data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                        'wiki_extract': extract
                    }
            except Exception:
                pass
            return None

        # Tier 1: Exact name
        wiki_data = _fetch(name)
        
        # Tier 2: Name (astronaut) or Name (cosmonaut) - specifically for crew enrichment
        if not wiki_data or len(wiki_data.get('wiki_extract', '')) < 50:
            wiki_data = _fetch(f"{name} (astronaut)") or _fetch(f"{name} (cosmonaut)") or wiki_data

        return wiki_data or {}

    def get(self, request):

        now = timezone.now()
        force_refresh = request.query_params.get('force_refresh') == 'true'

        # Return cached response if still fresh
        if not force_refresh and self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
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
                    # Robust in_space double check
                    if a.get('in_space') is False:
                        continue

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
                    
                    # Improved Craft Detection
                    craft = 'ISS' # Default fallback
                    ss = a.get('spacestation')
                    if ss and isinstance(ss, dict):
                        ss_name = ss.get('name', '')
                        if 'International Space Station' in ss_name:
                            craft = 'ISS'
                        elif 'Tiangong' in ss_name or 'CSS' in ss_name:
                            craft = 'Tiangong'
                        else:
                            craft = ss_name
                    else:
                        # Transit detection fallback
                        try:
                            last_flight = (a.get('last_flight') or '')
                            if 'shenzhou' in last_flight.lower() or 'tiangong' in last_flight.lower():
                                craft = 'Tiangong'
                            else:
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

            # If all sources failed, return 503 so the frontend shows its error state
            if not crew:
                logger.warning('All crew data sources failed, returning 503')
                return Response({'error': 'Crew data temporarily unavailable'}, status=503)

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
            ttl = dt.timedelta(minutes=30)
            ISSCrewView._cache = {'data': result, 'expires': now + ttl}
            return Response(result)


class LaunchPadWeatherView(APIView):
    """GET /api/launches/<api_id>/pad-weather/ - current weather at the launch pad"""
    permission_classes = [permissions.AllowAny]

    # Simple in-memory cache: {api_id: (expires, data)}
    _cache: dict = {}

    def get(self, request, api_id):

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


class StarshipTestsView(APIView):
    """GET /api/launches/starship-tests/ - dynamic Starship status with reliable fallbacks"""
    permission_classes = [permissions.AllowAny]

    # NASASpaceflight Channel ID: UCSUu1lih2RifWkKtDOJdsBA
    CHANNEL_ID = 'UCSUu1lih2RifWkKtDOJdsBA' 
    
    # Search keywords for Starship related content
    KEYWORDS = [
        'starship', 'starbase', 'booster', 'super heavy', 'boca chica', 
        'massey', 'static fire', 'ift', 'ship 3', 'ship 2', 'booster 1', 'booster 2'
    ]

    # Content to explicitly exclude (Artemis, SLS, Falcon 9, etc.)
    NEGATIVE_KEYWORDS = [
        'artemis', 'sls', 'falcon 9', 'falcon heavy', 'dragon', 
        'blue origin', 'new glenn', 'vulcan', 'atlas', 'soyuz', 'ariane'
    ]

    # Default/Fallback Checklist for Flight 12 (Current as of April 2026)
    FALLBACK_CHECKLIST = [
        {'task': 'Ship 39 Static Fire (Massey\'s)', 'status': 'complete'},
        {'task': 'Booster 19 Static Fire (33 Engines)', 'status': 'pending'},
        {'task': 'B19 / S39 Stacking (Pad 2)', 'status': 'pending'},
        {'task': 'Flight 12 Wet Dress Rehearsal', 'status': 'pending'},
        {'task': 'FAA Flight 12 Launch License', 'status': 'pending'},
    ]

    def get(self, request):
        rss_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={self.CHANNEL_ID}'
        
        checklist_defs = [
            {'key': 's39_static', 'label': 'Ship 39 Static Fire (Massey\'s)', 'keywords': ['ship 39 static', 's39 static']},
            {'key': 'b19_static', 'label': 'Booster 19 Static Fire', 'keywords': ['booster 19 static', 'b19 static']},
            {'key': 'stacking', 'label': 'B19 / S39 Stacking (Pad 2)', 'keywords': ['stacking', 'stacked', 'full stack']},
            {'key': 'wdr', 'label': 'Flight 12 Wet Dress Rehearsal', 'keywords': ['wdr', 'wet dress']},
            {'key': 'faa', 'label': 'FAA Flight 12 Launch License', 'keywords': ['faa license', 'launch license']},
        ]
        task_status = {d['key']: 'pending' for d in checklist_defs}
        task_status['s39_static'] = 'complete' # Seed from recent known test

        entries = []
        seen_ids = set()

        def add_entry(vid, title, link, published, thumbnail):
            if vid not in seen_ids:
                entries.append({
                    'id': vid,
                    'title': title,
                    'link': link,
                    'published': published,
                    'thumbnail': thumbnail
                })
                seen_ids.add(vid)

        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/xml,text/xml,*/*'
            }
            
            # --- Twitter/X Best Guess (SpaceX) ---
            # Try to find recent milestones from SpaceX's public timeline if possible
            try:
                # Note: This is a fragile 'best effort' scraper for public X profiles
                tx_resp = httpx.get('https://syndication.twitter.com/srv/timeline-profile/screen-name/SpaceX', timeout=8)
                if tx_resp.status_code == 200:
                    import re

                    # Pre-extract all keywords for fast path checking
                    all_keywords = []
                    for d in checklist_defs:
                        all_keywords.extend(d['keywords'])

                    # Look for text in the timeline JSON
                    tweets = re.findall(r'\"text\":\"([^\"]+)\"', tx_resp.text)
                    for tweet in tweets:
                        t_lower = tweet.lower()

                        # Fast path: check if ANY keyword is in the raw lowercase tweet.
                        # If not, skip the expensive decode.
                        match_found = False
                        for k in all_keywords:
                            if k in t_lower:
                                match_found = True
                                break

                        if not match_found:
                            continue

                        t_lower_decoded = t_lower.encode('utf-8').decode('unicode-escape', 'ignore')

                        for d in checklist_defs:
                            for k in d['keywords']:
                                if k in t_lower_decoded:
                                    if 'static fire' in t_lower_decoded and 'complete' in t_lower_decoded:
                                        task_status[d['key']] = 'complete'
                                    if 'stacked' in t_lower_decoded or 'stacking' in t_lower_decoded:
                                        task_status[d['key']] = 'complete'
                                    break
            except Exception:
                pass

            resp = httpx.get(rss_url, timeout=12, headers=headers, follow_redirects=True)
            
            # --- RSS Parsing ---
            if resp.status_code == 200:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(resp.content)
                ns = {'atom': 'http://www.w3.org/2005/Atom', 'media': 'http://search.yahoo.com/mrss/'}
                
                for entry in root.findall('atom:entry', ns):
                    title_elem = entry.find('atom:title', ns)
                    if title_elem is None: continue
                    title = title_elem.text
                    title_lower = title.lower()
                    
                    # Update checklist from titles
                    for d in checklist_defs:
                        if any(k in title_lower for k in d['keywords']):
                            if all(no not in title_lower for no in ['upcoming', 'live', 'scheduled']):
                                task_status[d['key']] = 'complete'

                    if any(k in title_lower for k in self.KEYWORDS):
                        if any(nk in title_lower for nk in self.NEGATIVE_KEYWORDS):
                            continue

                        video_id_elem = entry.find('atom:id', ns)
                        video_id = video_id_elem.text.split(':')[-1] if video_id_elem is not None else ''
                        link_elem = entry.find('atom:link', ns)
                        link = link_elem.attrib['href'] if link_elem is not None else ''
                        published_elem = entry.find('atom:published', ns)
                        published = published_elem.text if published_elem is not None else ''
                        
                        media_group = entry.find('media:group', ns)
                        thumbnail = ''
                        if media_group is not None:
                            thumb_elem = media_group.find('media:thumbnail', ns)
                            if thumb_elem is not None: thumbnail = thumb_elem.attrib.get('url', '')
                        
                        add_entry(video_id, title, link, published, thumbnail)
            
            # --- Scraper Fallback (if RSS is empty or failed) ---
            if not entries:
                logger.info(f"RSS failed or empty for {self.CHANNEL_ID}, attempting scraper fallback...")
                scrape_url = f"https://www.youtube.com/channel/{self.CHANNEL_ID}/videos"
                sresp = httpx.get(scrape_url, headers=headers, timeout=10, follow_redirects=True)
                if sresp.status_code == 200:
                    import re, html
                    pattern = r'"videoId":"(?P<id>[a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(?P<title>[^"]+)"\}\]'
                    video_matches = list(re.finditer(pattern, sresp.text))
                    
                    for match in video_matches[:25]:
                        vid = match.group('id')
                        raw_title = match.group('title')
                        
                        # Clean title properly using html unescape and handling unicode
                        try:
                            title = html.unescape(raw_title).encode('utf-8').decode('unicode-escape')
                        except Exception:
                            title = raw_title
                            
                        title_lower = title.lower()
                        
                        # Update checklist from scraped titles
                        for d in checklist_defs:
                            if any(k in title_lower for k in d['keywords']):
                                if all(no not in title_lower for no in ['upcoming', 'live', 'scheduled']):
                                    task_status[d['key']] = 'complete'

                        if any(k in title_lower for k in self.KEYWORDS):
                            if any(nk in title_lower for nk in self.NEGATIVE_KEYWORDS):
                                continue

                            published_date = timezone.now().strftime('%Y-%m-%dT%H:%M:%S+00:00')
                            add_entry(vid, title, f"https://www.youtube.com/watch?v={vid}", published_date, f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg")


            
            entries.sort(key=lambda x: x['published'], reverse=True)

            
            dynamic_checklist = []
            for d in checklist_defs:
                dynamic_checklist.append({
                    'task': d['label'],
                    'status': task_status[d['key']]
                })

            return Response({
                'videos': entries[:12],
                'checklist': dynamic_checklist
            })
        except Exception as e:
            logger.error(f"Critical error in StarshipTestsView: {e}")
            return Response({
                'videos': [], 
                'checklist': fallback_checklist
            }, status=200)


class SpaceWeatherView(APIView):
    """GET /api/space-weather/ - current space weather from NOAA and NASA"""
    permission_classes = [permissions.AllowAny]

    _cache = {'data': None, 'expires': None}

    def get(self, request):
        now = timezone.now()

        # Check cache (30 min TTL for higher resolution weather)
        if self._cache['data'] and self._cache['expires'] and now < self._cache['expires']:
            return Response(self._cache['data'])

        try:
            api_key = os.environ.get('NASA_API_KEY', 'DEMO_KEY')
            today = now.strftime('%Y-%m-%d')
            week_ago = (now - timedelta(days=7)).strftime('%Y-%m-%d')

            # 1. Fetch real-time K-index from NOAA (more granular than DONKI GST)
            kp = 0
            try:
                noaa_resp = httpx.get('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', timeout=10)
                if noaa_resp.status_code == 200:
                    noaa_data = noaa_resp.json()
                    if noaa_data and isinstance(noaa_data, list):
                        # Take the max of the last 60 minutes to smooth out drops to 0
                        # which frequently occur on the most recent minute due to estimation lag
                        recent = [d.get('kp_index', 0) for d in noaa_data[-60:]]
                        if recent:
                            kp = max(recent)
            except Exception as e:
                logger.warning(f"NOAA Kp fetch failed: {e}")

            # 2. Fetch recent solar flares from NASA DONKI
            flares = []
            try:
                flr_resp = httpx.get(
                    'https://api.nasa.gov/DONKI/FLR',
                    params={'startDate': week_ago, 'endDate': today, 'api_key': api_key},
                    timeout=10,
                )
                if flr_resp.status_code == 200:
                    flares = flr_resp.json()
                    if not isinstance(flares, list): flares = []
            except Exception: pass

            # Determine severity level
            if kp >= 7 or len(flares) > 5:
                level = 'severe'
                label = 'Storm Active'
            elif kp >= 4 or len(flares) > 2:
                level = 'moderate'
                label = 'Moderate Activity'
            else:
                level = 'nominal'
                label = 'Quiet' if kp < 2 else 'Unsettled'

            result = {
                'level': level,
                'label': label,
                'kp': kp,
                'flares': len(flares),
                'source': 'NOAA/NASA'
            }

            # Cache for 30 minutes
            SpaceWeatherView._cache = {
                'data': result,
                'expires': now + timedelta(minutes=30),
            }

            return Response(result)

        except Exception as e:
            return Response({
                'level': 'nominal',
                'label': 'Data Unavailable',
                'kp': 0,
                'flares': 0,
                'error': str(e)
            })
