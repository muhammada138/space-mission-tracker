"""
SpaceX API service layer (v5).
Note: The SpaceX API hasn't been actively maintained since late 2022,
so "upcoming" launches may be outdated. We filter by actual date.

Base URL: https://api.spacexdata.com/v5
"""

import httpx
from django.utils import timezone
from datetime import timedelta
from django.utils.dateparse import parse_datetime

from .models import Launch

SPACEX_BASE = "https://api.spacexdata.com/v5"
CACHE_TTL_MINUTES = 30

# Module-level cache for static data (rarely change)
_landpads_cache: dict = {}
_landpads_cache_time = None
_rockets_cache: dict = {}
_rockets_cache_time = None
_launchpads_cache: dict = {}
_launchpads_cache_time = None


def _parse_spacex_launch(
    data: dict,
    rockets_map: dict = None,
    launchpads_map: dict = None,
    landpads_map: dict = None,
) -> dict:
    """Normalise a SpaceX launch object into our Launch model fields."""
    rocket_id = data.get("rocket", "")
    rocket_name = ""
    if rockets_map and rocket_id in rockets_map:
        rocket_name = rockets_map[rocket_id]

    status = "Unknown"
    if data.get("upcoming"):
        status = "Go for Launch"
    elif data.get("success") is True:
        status = "Launch Successful"
    elif data.get("success") is False:
        status = "Launch Failure"

    # Images - try flickr first, then patch
    image_url = ""
    links = data.get("links", {})
    flickr = links.get("flickr", {})
    originals = flickr.get("original", [])
    if originals:
        image_url = originals[0]
    else:
        patch = links.get("patch", {})
        image_url = patch.get("large", patch.get("small", "")) or ""

    # Webcast - get YouTube URL and ID
    webcast_url = links.get("webcast", "") or ""
    youtube_id = links.get("youtube_id", "") or ""
    wiki_url = links.get("wikipedia", "") or ""

    # Launchpad info
    pad_name = ""
    pad_location = ""
    pad_latitude = None
    pad_longitude = None
    launchpad_id = data.get("launchpad", "")
    if launchpads_map and launchpad_id in launchpads_map:
        pad_info = launchpads_map[launchpad_id]
        pad_name = pad_info.get("name", "")
        pad_location = pad_info.get("locality", "")
        region = pad_info.get("region", "")
        if region and pad_location:
            pad_location = f"{pad_location}, {region}"
        pad_latitude = pad_info.get("latitude")
        pad_longitude = pad_info.get("longitude")

    # Landing pad info
    landing_pad = ""
    cores = data.get("cores", [])
    if cores and isinstance(cores, list) and landpads_map:
        lp_id = cores[0].get("landpad")
        if lp_id and lp_id in landpads_map:
            landing_pad = landpads_map[lp_id]

    # Build YouTube embed URL if we have an ID
    if youtube_id and not webcast_url:
        webcast_url = f"https://www.youtube.com/watch?v={youtube_id}"

    return {
        "api_id": f"spacex_{data.get('id', '')}",
        "name": data.get("name", ""),
        "rocket": rocket_name,
        "launch_provider": "SpaceX",
        "launch_date": data.get("date_utc") or None,
        "status": status,
        "mission_description": data.get("details", "") or "",
        "image_url": image_url,
        "pad_name": pad_name,
        "pad_location": pad_location,
        "pad_latitude": pad_latitude,
        "pad_longitude": pad_longitude,
        "orbit": "",
        "mission_type": "",
        "webcast_url": webcast_url,
        "wiki_url": wiki_url,
        "infographic_url": "",
        "landing_pad": landing_pad,
    }


def _get_rockets_map() -> dict:
    global _rockets_cache, _rockets_cache_time
    now = timezone.now()
    if _rockets_cache and _rockets_cache_time:
        if (now - _rockets_cache_time).total_seconds() < 86400:
            return _rockets_cache
    try:
        resp = httpx.get(f"{SPACEX_BASE}/rockets", timeout=10)
        resp.raise_for_status()
        result = {r["id"]: r["name"] for r in resp.json()}
        _rockets_cache = result
        _rockets_cache_time = now
        return result
    except Exception:
        return _rockets_cache if _rockets_cache else {}


def _get_launchpads_map() -> dict:
    global _launchpads_cache, _launchpads_cache_time
    now = timezone.now()
    if _launchpads_cache and _launchpads_cache_time:
        if (now - _launchpads_cache_time).total_seconds() < 86400:
            return _launchpads_cache
    try:
        resp = httpx.get(f"{SPACEX_BASE}/launchpads", timeout=10)
        resp.raise_for_status()
        result = {p["id"]: p for p in resp.json()}
        _launchpads_cache = result
        _launchpads_cache_time = now
        return result
    except Exception:
        return _launchpads_cache if _launchpads_cache else {}


def _get_landpads_map() -> dict:
    global _landpads_cache, _landpads_cache_time
    now = timezone.now()
    if _landpads_cache and _landpads_cache_time:
        age_seconds = (now - _landpads_cache_time).total_seconds()
        if (
            age_seconds < 86400
        ):  # 24-hour cache — landpad names essentially never change
            return _landpads_cache
    try:
        resp = httpx.get(f"{SPACEX_BASE}/landpads", timeout=10)
        resp.raise_for_status()
        result = {p["id"]: p.get("full_name", p.get("name", "")) for p in resp.json()}
        _landpads_cache = result
        _landpads_cache_time = now
        return result
    except Exception:
        # Return stale data rather than an empty dict so existing cached landing pads still display
        return _landpads_cache if _landpads_cache else {}


def _upsert_spacex_launches(
    results: list, rockets_map: dict, launchpads_map: dict, landpads_map: dict = None
) -> list:
    parsed_launches = []
    api_ids = []

    for raw in results:
        try:
            parsed = _parse_spacex_launch(
                raw, rockets_map, launchpads_map, landpads_map
            )
            parsed_launches.append(parsed)
            api_ids.append(parsed["api_id"])
        except Exception:
            continue

    if not parsed_launches:
        return []

    existing_launches = {
        obj.api_id: obj for obj in Launch.objects.filter(api_id__in=api_ids)
    }

    to_create = []
    to_update = []
    seen_new_ids = set()

    for parsed in parsed_launches:
        api_id = parsed["api_id"]
        if api_id in existing_launches:
            obj = existing_launches[api_id]
            for k, v in parsed.items():
                if k != "api_id":
                    setattr(obj, k, v)
            to_update.append(obj)
        elif api_id not in seen_new_ids:
            to_create.append(Launch(**parsed))
            seen_new_ids.add(api_id)

    if to_create:
        Launch.objects.bulk_create(to_create)
    if to_update:
        # Explicitly set last_fetched because bulk_update bypasses auto_now
        _now = timezone.now()
        for obj in to_update:
            obj.last_fetched = _now
        update_fields = [k for k in parsed_launches[0].keys() if k != "api_id"] + [
            "last_fetched"
        ]
        Launch.objects.bulk_update(to_update, update_fields)

    # Return the objects from DB to ensure they have PKs and are current
    return list(Launch.objects.filter(api_id__in=api_ids))


def _is_actually_future(data: dict) -> bool:
    """Check if a launch date is actually in the future."""
    date_str = data.get("date_utc", "")
    if not date_str:
        return False
    parsed = parse_datetime(date_str)
    if not parsed:
        return False
    return parsed > timezone.now()


def get_spacex_upcoming_launches(limit: int = 20) -> list:
    """Fetch upcoming SpaceX launches (filtered to actual future dates)."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        api_id__startswith="spacex_",
        launch_date__gte=timezone.now(),
        last_fetched__gte=cutoff,
    )
    if cached.exists():
        return list(cached.order_by("launch_date")[:limit])

    try:
        rockets_map = _get_rockets_map()
        launchpads_map = _get_launchpads_map()
        landpads_map = _get_landpads_map()
        resp = httpx.get(f"{SPACEX_BASE}/launches/upcoming", timeout=10)
        resp.raise_for_status()
        results = resp.json()
        # IMPORTANT: filter to only actual future launches
        results = [r for r in results if _is_actually_future(r)]
        if not results:
            # SpaceX API is stale, no actual future launches
            return []
        launches = _upsert_spacex_launches(
            results[:limit], rockets_map, launchpads_map, landpads_map
        )
        return sorted(launches, key=lambda l: l.launch_date or timezone.now())
    except Exception:
        return list(
            Launch.objects.filter(
                api_id__startswith="spacex_",
                launch_date__gte=timezone.now(),
            ).order_by("launch_date")[:limit]
        )


def get_spacex_past_launches(limit: int = 20) -> list:
    """Fetch recent past SpaceX launches."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        api_id__startswith="spacex_",
        launch_date__lt=timezone.now(),
        last_fetched__gte=cutoff,
    )
    if cached.exists():
        return list(cached.order_by("-launch_date")[:limit])

    try:
        rockets_map = _get_rockets_map()
        launchpads_map = _get_launchpads_map()
        landpads_map = _get_landpads_map()
        resp = httpx.get(f"{SPACEX_BASE}/launches/past", timeout=10)
        resp.raise_for_status()
        results = resp.json()
        results = sorted(results, key=lambda x: x.get("date_utc", ""), reverse=True)[
            :limit
        ]
        launches = _upsert_spacex_launches(
            results, rockets_map, launchpads_map, landpads_map
        )
        return sorted(
            launches, key=lambda l: l.launch_date or timezone.now(), reverse=True
        )
    except Exception:
        return list(
            Launch.objects.filter(
                api_id__startswith="spacex_",
                launch_date__lt=timezone.now(),
            ).order_by("-launch_date")[:limit]
        )


def get_spacex_launch_by_id(spacex_id: str) -> Launch | None:
    """Fetch a single SpaceX launch by ID (the raw SpaceX ID, not our spacex_ prefixed one)."""
    try:
        # Clean the ID if it was passed with our internal prefix
        clean_id = spacex_id.replace("spacex_", "")

        rockets_map = _get_rockets_map()
        launchpads_map = _get_launchpads_map()
        landpads_map = _get_landpads_map()

        resp = httpx.get(f"{SPACEX_BASE}/launches/{clean_id}", timeout=10)
        resp.raise_for_status()
        raw = resp.json()

        parsed = _parse_spacex_launch(raw, rockets_map, launchpads_map, landpads_map)
        obj, _ = Launch.objects.update_or_create(
            api_id=parsed["api_id"],
            defaults=parsed,
        )
        return obj
    except Exception:
        return None
