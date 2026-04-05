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
        if source in ('ll2', 'all'):
            try:
                launches += get_upcoming_launches(limit=100)
            except Exception:
                pass  # LL2 may be rate-limited, keep going
        if source in ('spacex', 'all'):
            try:
                launches += get_spacex_upcoming_launches(limit=100)
            except Exception:
                pass
        # Sort by launch date, None-safe
        launches.sort(key=lambda l: _to_dt(l.launch_date, _FAR_FUTURE))
        return Response(LaunchSerializer(launches, many=True).data)


class PastLaunchesView(APIView):
    """GET /api/launches/past/?source=ll2|spacex|all"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        source = request.query_params.get('source', 'all')
        launches = []
        if source in ('ll2', 'all'):
            try:
                launches += get_past_launches(limit=100)
            except Exception:
                pass
        if source in ('spacex', 'all'):
            try:
                launches += get_spacex_past_launches(limit=100)
            except Exception:
                pass
        launches.sort(key=lambda l: _to_dt(l.launch_date, _FAR_PAST), reverse=True)
        return Response(LaunchSerializer(launches, many=True).data)


class ActiveLaunchesView(APIView):
    """GET /api/launches/active/ - missions currently in flight"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .services import _upsert_launches, _parse_launch
        import httpx

        # LL2 status ID 6 = "In Flight"
        # First check DB cache
        active = Launch.objects.filter(
            status__icontains='in flight'
        ).order_by('-launch_date')

        if active.exists():
            return Response(LaunchSerializer(active, many=True).data)

        # Fetch directly from LL2 with status=6 (In Flight)
        try:
            resp = httpx.get(
                'https://ll.thespacedevs.com/2.2.0/launch/',
                params={'status': 6, 'mode': 'detailed', 'limit': 10},
                timeout=15,
            )
            resp.raise_for_status()
            results = resp.json().get('results', [])
            if results:
                launches = _upsert_launches(results)
                return Response(LaunchSerializer(launches, many=True).data)
        except Exception:
            pass

        # Fallback: no in-flight missions right now
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

