"""
SpaceX API service layer (v5).
Fetches from the open SpaceX REST API and normalises data into our
Launch model format.

Base URL: https://api.spacexdata.com/v5
Endpoints:
  - GET /launches/upcoming
  - GET /launches/past
  - GET /rockets (for resolving rocket names)
"""

import httpx
from django.utils import timezone
from datetime import timedelta

from .models import Launch

SPACEX_BASE = 'https://api.spacexdata.com/v5'
CACHE_TTL_MINUTES = 30


def _parse_spacex_launch(data: dict, rockets_map: dict = None, launchpads_map: dict = None) -> dict:
    """Normalise a SpaceX launch object into our Launch model fields."""
    rocket_id = data.get('rocket', '')
    rocket_name = ''
    if rockets_map and rocket_id in rockets_map:
        rocket_name = rockets_map[rocket_id]

    status = 'Unknown'
    if data.get('upcoming'):
        status = 'Go for Launch'
    elif data.get('success') is True:
        status = 'Launch Successful'
    elif data.get('success') is False:
        status = 'Launch Failure'

    # Images - try flickr first, then patch
    image_url = ''
    links = data.get('links', {})
    flickr = links.get('flickr', {})
    originals = flickr.get('original', [])
    if originals:
        image_url = originals[0]
    else:
        patch = links.get('patch', {})
        image_url = patch.get('large', patch.get('small', '')) or ''

    # Webcast and wiki
    webcast_url = links.get('webcast', '') or ''
    wiki_url = links.get('wikipedia', '') or ''

    # Launchpad info
    pad_name = ''
    pad_location = ''
    launchpad_id = data.get('launchpad', '')
    if launchpads_map and launchpad_id in launchpads_map:
        pad_info = launchpads_map[launchpad_id]
        pad_name = pad_info.get('name', '')
        pad_location = pad_info.get('locality', '')
        region = pad_info.get('region', '')
        if region and pad_location:
            pad_location = f"{pad_location}, {region}"

    return {
        'api_id': f"spacex_{data.get('id', '')}",
        'name': data.get('name', ''),
        'rocket': rocket_name,
        'launch_provider': 'SpaceX',
        'launch_date': data.get('date_utc') or None,
        'status': status,
        'mission_description': data.get('details', '') or '',
        'image_url': image_url,
        'pad_name': pad_name,
        'pad_location': pad_location,
        'orbit': '',
        'mission_type': '',
        'webcast_url': webcast_url,
        'wiki_url': wiki_url,
        'infographic_url': '',
    }


def _get_rockets_map() -> dict:
    """Fetch all SpaceX rockets and return {id: name} mapping."""
    try:
        resp = httpx.get(f'{SPACEX_BASE}/rockets', timeout=10)
        resp.raise_for_status()
        return {r['id']: r['name'] for r in resp.json()}
    except Exception:
        return {}


def _get_launchpads_map() -> dict:
    """Fetch all SpaceX launchpads and return {id: info} mapping."""
    try:
        resp = httpx.get(f'{SPACEX_BASE}/launchpads', timeout=10)
        resp.raise_for_status()
        return {p['id']: p for p in resp.json()}
    except Exception:
        return {}


def _upsert_spacex_launches(results: list, rockets_map: dict, launchpads_map: dict) -> list:
    """Upsert SpaceX launches into the DB."""
    launches = []
    for raw in results:
        try:
            parsed = _parse_spacex_launch(raw, rockets_map, launchpads_map)
            obj, _ = Launch.objects.update_or_create(
                api_id=parsed['api_id'],
                defaults=parsed,
            )
            launches.append(obj)
        except Exception:
            continue
    return launches


def get_spacex_upcoming_launches(limit: int = 20) -> list:
    """Fetch upcoming SpaceX launches."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        api_id__startswith='spacex_',
        launch_date__gte=timezone.now(),
        last_fetched__gte=cutoff,
    )
    if cached.exists():
        return list(cached.order_by('launch_date')[:limit])

    try:
        rockets_map = _get_rockets_map()
        launchpads_map = _get_launchpads_map()
        resp = httpx.get(f'{SPACEX_BASE}/launches/upcoming', timeout=10)
        resp.raise_for_status()
        results = resp.json()
        launches = _upsert_spacex_launches(results[:limit], rockets_map, launchpads_map)
        return sorted(launches, key=lambda l: l.launch_date or timezone.now())
    except Exception:
        return list(Launch.objects.filter(
            api_id__startswith='spacex_',
            launch_date__gte=timezone.now(),
        ).order_by('launch_date')[:limit])


def get_spacex_past_launches(limit: int = 20) -> list:
    """Fetch recent past SpaceX launches."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        api_id__startswith='spacex_',
        launch_date__lt=timezone.now(),
        last_fetched__gte=cutoff,
    )
    if cached.exists():
        return list(cached.order_by('-launch_date')[:limit])

    try:
        rockets_map = _get_rockets_map()
        launchpads_map = _get_launchpads_map()
        resp = httpx.get(f'{SPACEX_BASE}/launches/past', timeout=10)
        resp.raise_for_status()
        results = resp.json()
        results = sorted(results, key=lambda x: x.get('date_utc', ''), reverse=True)[:limit]
        launches = _upsert_spacex_launches(results, rockets_map, launchpads_map)
        return sorted(launches, key=lambda l: l.launch_date or timezone.now(), reverse=True)
    except Exception:
        return list(Launch.objects.filter(
            api_id__startswith='spacex_',
            launch_date__lt=timezone.now(),
        ).order_by('-launch_date')[:limit])
