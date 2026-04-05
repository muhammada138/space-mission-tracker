"""
Launch Library 2 service layer.
Fetches from the API and upserts into the local DB cache.
Cache TTL is 2 hours to avoid hitting LL2 rate limits.
"""

import httpx
from django.utils import timezone
from datetime import timedelta

from .models import Launch

LL2_BASE = 'https://ll.thespacedevs.com/2.2.0'
CACHE_TTL_MINUTES = 120  # 2 hours - LL2 rate-limits aggressively


def _parse_launch(data: dict) -> dict:
    """Extract fields from a LL2 launch object."""
    rocket_name = ''
    try:
        rocket_name = data['rocket']['configuration']['name']
    except (KeyError, TypeError):
        pass

    provider_name = ''
    try:
        provider_name = data['launch_service_provider']['name']
    except (KeyError, TypeError):
        pass

    mission_desc = ''
    mission_type = ''
    orbit = ''
    try:
        mission = data.get('mission') or {}
        mission_desc = mission.get('description', '') or ''
        mission_type = mission.get('type', '') or ''
        orbit_data = mission.get('orbit') or {}
        orbit = orbit_data.get('name', '') if isinstance(orbit_data, dict) else str(orbit_data)
    except (KeyError, TypeError):
        pass

    status_name = ''
    try:
        status_name = data['status']['name']
    except (KeyError, TypeError):
        pass

    # Pad info
    pad_name = ''
    pad_location = ''
    try:
        pad = data.get('pad') or {}
        pad_name = pad.get('name', '') or ''
        loc = pad.get('location') or {}
        pad_location = loc.get('name', '') or ''
    except (KeyError, TypeError):
        pass

    # URLs
    image_url = data.get('image', '') or ''
    infographic_url = ''
    try:
        infographic_url = data.get('infographic', '') or ''
    except (KeyError, TypeError):
        pass

    webcast_url = ''
    try:
        vid_urls = data.get('vidURLs') or data.get('vid_urls') or []
        if vid_urls and len(vid_urls) > 0:
            first_vid = vid_urls[0]
            webcast_url = first_vid.get('url', '') if isinstance(first_vid, dict) else str(first_vid)
    except (KeyError, TypeError, IndexError):
        pass

    wiki_url = ''
    try:
        wiki_url = data.get('wiki_url', '') or ''
    except (KeyError, TypeError):
        pass

    return {
        'api_id': str(data['id']),
        'name': data.get('name', ''),
        'rocket': rocket_name,
        'launch_provider': provider_name,
        'launch_date': data.get('net') or None,
        'status': status_name,
        'mission_description': mission_desc,
        'image_url': image_url,
        'pad_name': pad_name,
        'pad_location': pad_location,
        'orbit': orbit,
        'mission_type': mission_type,
        'webcast_url': webcast_url,
        'wiki_url': wiki_url,
        'infographic_url': infographic_url,
    }


def _upsert_launches(results: list) -> list:
    """Upsert LL2 launch dicts into the DB."""
    launches = []
    for raw in results:
        try:
            parsed = _parse_launch(raw)
            obj, _ = Launch.objects.update_or_create(
                api_id=parsed['api_id'],
                defaults=parsed,
            )
            launches.append(obj)
        except Exception:
            continue
    return launches


def get_upcoming_launches(limit: int = 20) -> list:
    """Fetch upcoming launches. Uses DB cache if fresh enough."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        launch_date__gte=timezone.now(),
        last_fetched__gte=cutoff,
    ).exclude(api_id__startswith='spacex_')

    if cached.exists():
        return list(cached.order_by('launch_date')[:limit])

    try:
        resp = httpx.get(
            f'{LL2_BASE}/launch/upcoming/',
            params={'limit': limit, 'mode': 'detailed'},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])
        if results:
            return _upsert_launches(results)
    except Exception:
        pass

    return list(
        Launch.objects.filter(launch_date__gte=timezone.now())
        .exclude(api_id__startswith='spacex_')
        .order_by('launch_date')[:limit]
    )


def get_past_launches(limit: int = 20) -> list:
    """Fetch recent past launches."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        launch_date__lt=timezone.now(),
        last_fetched__gte=cutoff,
    ).exclude(api_id__startswith='spacex_')

    if cached.exists():
        return list(cached.order_by('-launch_date')[:limit])

    try:
        resp = httpx.get(
            f'{LL2_BASE}/launch/previous/',
            params={'limit': limit, 'mode': 'detailed'},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])
        if results:
            return _upsert_launches(results)
    except Exception:
        pass

    return list(
        Launch.objects.filter(launch_date__lt=timezone.now())
        .exclude(api_id__startswith='spacex_')
        .order_by('-launch_date')[:limit]
    )


def get_launch_by_api_id(api_id: str) -> Launch | None:
    """Fetch a single launch by LL2 api_id, refreshing cache if stale."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    try:
        obj = Launch.objects.get(api_id=api_id)
        if obj.last_fetched >= cutoff:
            return obj
    except Launch.DoesNotExist:
        pass

    try:
        resp = httpx.get(
            f'{LL2_BASE}/launch/{api_id}/',
            params={'mode': 'detailed'},
            timeout=15,
        )
        resp.raise_for_status()
        parsed = _parse_launch(resp.json())
        obj, _ = Launch.objects.update_or_create(api_id=api_id, defaults=parsed)
        return obj
    except Exception:
        return Launch.objects.filter(api_id=api_id).first()
