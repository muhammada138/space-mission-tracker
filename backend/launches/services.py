"""
Launch Library 2 service layer.
Fetches from the API and upserts into the local DB cache.
Cache TTL is 2 hours to avoid hammering the rate-limited API.
"""

import httpx
from django.utils import timezone
from datetime import timedelta

from .models import Launch

LL2_BASE = 'https://ll.thespacedevs.com/2.2.0'
CACHE_TTL_MINUTES = 120  # 2 hours - LL2 rate-limits aggressively


def _parse_launch(data: dict) -> dict:
    """Extract and normalise fields from a LL2 launch object."""
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
    try:
        mission_desc = data['mission']['description'] or ''
    except (KeyError, TypeError):
        pass

    status_name = ''
    try:
        status_name = data['status']['name']
    except (KeyError, TypeError):
        pass

    image_url = data.get('image', '') or ''

    return {
        'api_id': str(data['id']),
        'name': data.get('name', ''),
        'rocket': rocket_name,
        'launch_provider': provider_name,
        'launch_date': data.get('net') or None,
        'status': status_name,
        'mission_description': mission_desc,
        'image_url': image_url,
    }


def _upsert_launches(results: list) -> list:
    """Upsert a list of raw LL2 launch dicts into the DB and return Launch objects."""
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
            continue  # Skip malformed entries
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

    # Try fetching from API
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

    # Fall back to any LL2 cached data, even if stale
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
    """Fetch a single launch by its LL2 api_id, refreshing cache if needed."""
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
