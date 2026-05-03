"""
Launch Library 2 service layer.
Fetches from the API and upserts into the local DB cache.
Cache TTL is 2 hours to avoid hitting LL2 rate limits.
"""

import datetime as dt
import httpx
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta
import logging

from .models import Launch

logger = logging.getLogger(__name__)

LL2_BASE = "https://ll.thespacedevs.com/2.2.0"
CACHE_TTL_MINUTES = 120  # 2 hours - LL2 rate-limits aggressively

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


def _parse_launch(data: dict) -> dict:
    """Extract fields from a LL2 launch object."""
    rocket_name = ""
    try:
        # Prefer full_name if available, fallback to name
        config = data["rocket"]["configuration"]
        rocket_name = config.get("full_name") or config.get("name") or ""
    except (KeyError, TypeError):
        pass

    provider_name = ""
    try:
        provider_name = data["launch_service_provider"]["name"]
    except (KeyError, TypeError):
        pass

    # Data Cleanup: CAS Space often has weird configuration names in LL2
    # e.g. "8 x Jilin-1" instead of "Kinetica 1"
    if provider_name == "CAS Space":
        if (
            not rocket_name
            or "Jilin" in rocket_name
            or "satellite" in rocket_name.lower()
            or "8 x" in rocket_name
        ):
            rocket_name = "Kinetica 1"

    mission_desc = ""
    mission_type = ""
    orbit = ""
    try:
        mission = data.get("mission") or {}
        if not isinstance(mission, dict):
            mission = {}
        mission_desc = mission.get("description", "") or ""
        mission_type = mission.get("type", "") or ""
        orbit_data = mission.get("orbit") or {}
        orbit = (
            orbit_data.get("name", "")
            if isinstance(orbit_data, dict)
            else str(orbit_data)
        )
    except (KeyError, TypeError):
        pass

    status_name = ""
    try:
        status_name = data["status"]["name"]
    except (KeyError, TypeError):
        pass

    # Pad info
    pad_name = ""
    pad_location = ""
    pad_latitude = None
    pad_longitude = None
    try:
        pad = data.get("pad") or {}
        if not isinstance(pad, dict):
            pad = {}
        pad_name = pad.get("name", "") or ""
        loc = pad.get("location") or {}
        if not isinstance(loc, dict):
            loc = {}
        pad_location = loc.get("name", "") or ""
        lat = pad.get("latitude")
        lon = pad.get("longitude")
        if lat:
            pad_latitude = float(lat)
        if lon:
            pad_longitude = float(lon)
    except (KeyError, TypeError, ValueError):
        pass

    # URLs
    image_url = data.get("image", "") or ""
    infographic_url = ""
    try:
        infographic_url = data.get("infographic", "") or ""
    except (KeyError, TypeError):
        pass

    webcast_url = ""
    try:
        vid_urls = data.get("vidURLs") or data.get("vid_urls") or []
        if not isinstance(vid_urls, list):
            vid_urls = []
        if vid_urls:
            # First, try to find a YouTube link because we can embed it
            yt_vids = [
                v
                for v in vid_urls
                if "youtube.com"
                in (v.get("url", "") if isinstance(v, dict) else str(v)).lower()
                or "youtu.be"
                in (v.get("url", "") if isinstance(v, dict) else str(v)).lower()
            ]

            if yt_vids:
                # Priority sort the YouTube ones
                sorted_yt = sorted(
                    yt_vids,
                    key=lambda v: v.get("priority", 0) if isinstance(v, dict) else 0,
                    reverse=True,
                )
                first_vid = sorted_yt[0]
                webcast_url = (
                    first_vid.get("url", "")
                    if isinstance(first_vid, dict)
                    else str(first_vid)
                )
            else:
                # Fallback to whatever is highest priority (like X/Twitter)
                sorted_vids = sorted(
                    vid_urls,
                    key=lambda v: v.get("priority", 0) if isinstance(v, dict) else 0,
                    reverse=True,
                )
                first_vid = sorted_vids[0]
                webcast_url = (
                    first_vid.get("url", "")
                    if isinstance(first_vid, dict)
                    else str(first_vid)
                )
    except (KeyError, TypeError, IndexError):
        pass

    wiki_url = ""
    try:
        wiki_url = data.get("wiki_url", "") or ""
    except (KeyError, TypeError):
        pass

    # Landing pad info
    landing_pad = ""
    try:
        launcher_stages = data.get("rocket", {}).get("launcher_stage", [])
        if launcher_stages and isinstance(launcher_stages, list):
            # Try to find a successful landing or at least a landing location
            for ls in launcher_stages:
                landing = ls.get("landing")
                if landing and isinstance(landing, dict):
                    loc = landing.get("location")
                    if loc and isinstance(loc, dict):
                        landing_pad = loc.get("name", "")
                        if landing_pad:
                            break
    except (KeyError, TypeError):
        pass

    return {
        "api_id": str(data["id"]),
        "name": data.get("name", ""),
        "rocket": rocket_name,
        "launch_provider": provider_name,
        "launch_date": data.get("net") or None,
        "status": status_name,
        "mission_description": mission_desc,
        "image_url": image_url,
        "pad_name": pad_name,
        "pad_location": pad_location,
        "pad_latitude": pad_latitude,
        "pad_longitude": pad_longitude,
        "orbit": orbit,
        "mission_type": mission_type,
        "webcast_url": webcast_url,
        "wiki_url": wiki_url,
        "infographic_url": infographic_url,
        "landing_pad": landing_pad,
    }


def _upsert_launches(results: list) -> list:
    """Upsert LL2 launch dicts into the DB."""
    parsed_results = []
    requested_api_ids = []
    seen_api_ids = set()

    # Parse inputs, preserving the original requested order (including duplicates if any)
    for raw in results:
        try:
            parsed = _parse_launch(raw)
            api_id = parsed["api_id"]
            requested_api_ids.append(api_id)
            if api_id not in seen_api_ids:
                seen_api_ids.add(api_id)
                parsed_results.append(parsed)
        except Exception:
            continue

    if not parsed_results:
        return []

    # Find existing records
    unique_api_ids = list(seen_api_ids)
    existing_records = {
        obj.api_id: obj for obj in Launch.objects.filter(api_id__in=unique_api_ids)
    }

    to_create = []
    to_update = []
    successful_api_ids = set()

    # Safely derive update fields from all dicts
    update_fields_set = set()
    for parsed in parsed_results:
        update_fields_set.update(parsed.keys())
    update_fields = [key for key in update_fields_set if key != "api_id"]

    for parsed in parsed_results:
        api_id = parsed.get("api_id")
        try:
            if api_id in existing_records:
                obj = existing_records[api_id]
                for field in update_fields:
                    if field in parsed:
                        setattr(obj, field, parsed[field])
                to_update.append(obj)
            else:
                to_create.append(Launch(**parsed))
            successful_api_ids.add(api_id)
        except Exception:
            # If a single item fails instantiation/setup, skip it
            continue

    # Perform bulk operations
    try:
        if to_create:
            Launch.objects.bulk_create(to_create)
        if to_update:
            # Explicitly set last_fetched because bulk_update bypasses auto_now
            _now = timezone.now()
            for obj in to_update:
                obj.last_fetched = _now
            _update_fields = (
                update_fields + ["last_fetched"]
                if "last_fetched" not in update_fields
                else update_fields
            )
            Launch.objects.bulk_update(to_update, fields=_update_fields)
    except Exception:
        successful_api_ids.clear()
        # Fallback to iterative update_or_create to preserve exact error handling behavior
        for parsed in parsed_results:
            try:
                Launch.objects.update_or_create(
                    api_id=parsed["api_id"],
                    defaults=parsed,
                )
                successful_api_ids.add(parsed["api_id"])
            except Exception:
                continue

    if not successful_api_ids:
        return []

    # Fetch fresh objects to return them in their requested order
    fetched_launches = {
        launch.api_id: launch
        for launch in Launch.objects.filter(api_id__in=list(successful_api_ids))
    }

    # Return in the exact order requested by `results`, excluding those that failed
    return [
        fetched_launches[api_id]
        for api_id in requested_api_ids
        if api_id in fetched_launches
    ]


def get_active_launches() -> tuple[list[Launch], list[Launch]]:
    """Fetch active/in-flight missions. Returns (launches, active_fallback)."""
    active = []
    try:
        now = timezone.now()
        raw_active = list(
            Launch.objects.filter(status__icontains="in flight").order_by(
                "-launch_date"
            )
        )

        needs_refresh = []
        spacex_refresh = []

        for l in raw_active:
            ldate = _to_dt(l.launch_date, _FAR_PAST)
            # 24h safety cutoff for "In Flight" status
            if ldate != _FAR_PAST and ldate < (now - timedelta(hours=24)):
                # Hard cutoff: missions older than 48h are long-duration/payload missions.
                # They belong in the Payloads tab, not Currently Active.
                if ldate < (now - timedelta(hours=48)):
                    continue
                # If between 24-48h old, try to refresh once to confirm it's over
                if str(l.api_id).startswith("spacex_"):
                    spacex_refresh.append(l)
                else:
                    needs_refresh.append(l)
            else:
                active.append(l)

        # Batch refresh LL2 launches
        if needs_refresh:
            try:
                refreshed_list = refresh_launches_by_api_ids(
                    [l.api_id for l in needs_refresh]
                )
                for refreshed in refreshed_list:
                    if refreshed and "in flight" in (refreshed.status or "").lower():
                        active.append(refreshed)
            except Exception:
                pass

        # Fallback to individual refresh for SpaceX launches (not supported by LL2)
        for l in spacex_refresh:
            try:
                refreshed = get_launch_by_api_id(l.api_id, force_refresh=True)
                if refreshed and "in flight" in (refreshed.status or "").lower():
                    active.append(refreshed)
            except Exception:
                pass

        # Re-sort to preserve the expected chronological order
        active.sort(key=lambda x: x.launch_date, reverse=True)

        # We purposely do NOT return early here because we want to also fetch recent success
        # missions that have currently active spacecraft from the LL2 API.

        # Fetch directly from LL2 with status=6 (In Flight)
        try:
            resp = httpx.get(
                "https://ll.thespacedevs.com/2.2.0/launch/",
                params={"status": 6, "mode": "detailed", "limit": 10},
                timeout=15,
            )
            if resp.status_code == 200:
                results = resp.json().get("results", [])
            else:
                results = []

            # Dynamically fetch recent launches to find active spacecraft
            # (Launch status is "Success", but Spacecraft is "Active")
            try:
                past_resp = httpx.get(
                    "https://ll.thespacedevs.com/2.2.0/launch/previous/",
                    params={"mode": "detailed", "limit": 20},
                    timeout=15,
                )
                if past_resp.status_code == 200:
                    past_data = past_resp.json().get("results", [])
                    existing_ids = {r["id"] for r in results if "id" in r}
                    # Only include spacecraft-in-space missions launched within the last 3 days.
                    # Older missions (like Cygnus resupply) belong in the Payloads tab.
                    in_space_cutoff = now - timedelta(days=3)
                    for launch in past_data:
                        stage = launch.get("rocket", {}).get("spacecraft_stage", {})
                        ldate_check = _to_dt(launch.get("net"), _FAR_PAST)
                        # If the spacecraft stage indicates the craft is currently in space, route it as active
                        if (
                            stage
                            and stage.get("spacecraft", {}).get("in_space") is True
                            and ldate_check >= in_space_cutoff
                        ):
                            if "id" in launch and launch["id"] not in existing_ids:
                                # Force status to 'In Flight' so frontend treats it as an active mission
                                if "status" in launch and isinstance(
                                    launch["status"], dict
                                ):
                                    launch["status"]["name"] = "In Flight"
                                    launch["status"]["abbrev"] = "In Flight"
                                results.append(launch)
                                existing_ids.add(launch["id"])
            except Exception:
                pass

            now = timezone.now()

            # --- Bridge the LL2 "Status 6" gap ---
            # Fetch missions from the last 3 hours and force them to 'Active'
            # while they climb to orbit, even if LL2 hasn't flagged them status 6 yet.
            recent_cutoff = now - timedelta(hours=3)
            # ⚡ Bolt: Performance: Database-level filtering instead of fetching all records into memory
            recent_successes = list(
                Launch.objects.filter(
                    launch_date__gte=recent_cutoff,
                    launch_date__lte=now
                ).exclude(status__icontains="fail")
            )

            # Pre-extract existing result IDs into a set for O(1) lookup.
            # This avoids an O(N*M) nested loop when iterating over recent_successes below.
            existing_result_ids: set[str] = set()
            for r in results:
                try:
                    rid = (
                        r.get("id")
                        if isinstance(r, dict)
                        else (
                            getattr(r, "id", None)
                            if not hasattr(r, "__getitem__")
                            else r["id"]
                        )
                    )
                    existing_result_ids.add(str(rid))
                except Exception:
                    pass

            for l in recent_successes:
                # Ensure we don't duplicate missions already in 'results'
                api_id_str = str(l.api_id)
                if api_id_str not in existing_result_ids:
                    # Convert model back to a dict mimicking LL2 results for _upsert
                    results.append(
                        {
                            "id": l.api_id,
                            "name": l.name,
                            "net": l.launch_date.isoformat(),
                            "status": {
                                "name": "In Flight",
                                "abbrev": "In Flight",
                            },  # Force active
                            "rocket": {"configuration": {"name": l.rocket}},
                            "launch_service_provider": {"name": l.launch_provider},
                        }
                    )
                    existing_result_ids.add(api_id_str)

            # Transition to active 5 minutes before scheduled launch
            active_threshold = now + timedelta(minutes=5)
            results = [
                r
                for r in results
                if _to_dt(
                    r.get("net") if isinstance(r, dict) else getattr(r, "net", None),
                    _FAR_FUTURE,
                )
                <= active_threshold
            ]

            # Exclude missions launched more than 48h ago — those are long-duration missions
            # (e.g. Cygnus resupply, Dragon crew) that belong in the "In Orbit" tab.
            active_floor = now - timedelta(hours=48)
            results = [
                r
                for r in results
                if _to_dt(
                    r.get("net") if isinstance(r, dict) else getattr(r, "net", None),
                    _FAR_PAST,
                )
                >= active_floor
            ]

            if results:
                launches = list(_upsert_launches(results))

                # --- Post-Upsert Status Enforcement ---
                # Ensure missions we manually identified as 'active' keep their
                # status flag in the final response objects.
                for l in launches:
                    ldate = _to_dt(l.launch_date, _FAR_PAST)
                    if ldate != _FAR_PAST and (now - timedelta(hours=3)) <= ldate <= (
                        now + timedelta(minutes=5)
                    ):
                        # If it's a known success/fail, don't overwrite it unless it's very recent
                        if "Success" not in (l.status or "") and "Fail" not in (
                            l.status or ""
                        ):
                            l.status = "In Flight"

                # Combine with db cache hits to ensure nothing is lost during transition
                result_ids = {l.api_id for l in launches}
                for a in active:
                    if a.api_id not in result_ids:
                        launches.append(a)

                # Sort the combined objects by launch date descending
                launches.sort(
                    key=lambda x: x.launch_date if x.launch_date else x.last_fetched,
                    reverse=True,
                )

                return launches, active
            else:
                return [], active

        except Exception as e:
            logger.error(
                f"Critical error fetching real-time active launches: {e}", exc_info=True
            )
            return [], active

    except Exception as e:
        logger.error(f"Critical error in get_active_launches: {e}", exc_info=True)
        return [], active


def get_upcoming_launches(limit: int = 20) -> list:
    """Fetch upcoming launches. Uses DB cache if fresh enough."""
    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        launch_date__gte=timezone.now(),
        last_fetched__gte=cutoff,
    ).exclude(api_id__startswith="spacex_")

    if cached.exists():
        return list(cached.order_by("launch_date")[:limit])

    try:
        resp = httpx.get(
            f"{LL2_BASE}/launch/upcoming/",
            params={"limit": limit, "mode": "detailed"},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return _upsert_launches(results)
    except Exception:
        pass

    return list(
        Launch.objects.filter(launch_date__gte=timezone.now())
        .exclude(api_id__startswith="spacex_")
        .order_by("launch_date")[:limit]
    )


def get_past_launches(limit: int = 20) -> list:
    """Fetch recent past launches."""
    now = timezone.now()
    cutoff = now - timedelta(minutes=CACHE_TTL_MINUTES)
    cached = Launch.objects.filter(
        launch_date__lt=now,
        last_fetched__gte=cutoff,
    ).exclude(api_id__startswith="spacex_")

    if cached.exists():
        # Don't serve from cache if any recently-launched mission still has a
        # non-terminal status AND hasn't been refreshed within the last 30 minutes.
        # This ensures "To Be Confirmed" missions get updated after they fly.
        month_ago = now - timedelta(days=30)
        short_cutoff = now - timedelta(minutes=30)
        has_stale_unresolved = (
            Launch.objects.filter(
                launch_date__lt=now,
                launch_date__gte=month_ago,
                last_fetched__lte=short_cutoff,
            )
            .exclude(api_id__startswith="spacex_")
            .exclude(status__icontains="success")
            .exclude(status__icontains="fail")
            .exists()
        )

        if not has_stale_unresolved:
            return list(cached.order_by("-launch_date")[:limit])

    try:
        resp = httpx.get(
            f"{LL2_BASE}/launch/previous/",
            params={"limit": limit, "mode": "detailed"},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return _upsert_launches(results)
    except Exception:
        pass

    return list(
        Launch.objects.filter(launch_date__lt=timezone.now())
        .exclude(api_id__startswith="spacex_")
        .order_by("-launch_date")[:limit]
    )


def refresh_launches_by_api_ids(api_ids: list[str]) -> list[Launch]:
    """Fetch multiple launches by LL2 api_ids in a single API call."""
    if not api_ids:
        return []

    # Do not include spacex_ prefixed ids, they are not valid LL2 ids
    ll2_ids = [
        str(api_id) for api_id in api_ids if not str(api_id).startswith("spacex_")
    ]
    if not ll2_ids:
        return []

    try:
        resp = httpx.get(
            f"{LL2_BASE}/launch/",
            params={
                "id__in": ",".join(ll2_ids),
                "mode": "detailed",
                "limit": len(ll2_ids),
            },
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return _upsert_launches(results)
    except Exception:
        return list(Launch.objects.filter(api_id__in=ll2_ids))


def get_launch_by_api_id(api_id: str, force_refresh: bool = False) -> Launch | None:
    """Fetch a single launch by LL2 api_id, refreshing cache if stale."""
    # Handle SpaceX-prefixed IDs by routing to SpaceX service
    if str(api_id).startswith("spacex_"):
        from .spacex_service import get_spacex_launch_by_id

        return get_spacex_launch_by_id(api_id)

    cutoff = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES)
    try:
        obj = Launch.objects.get(api_id=api_id)
        if not force_refresh and obj.last_fetched >= cutoff:
            return obj
    except Launch.DoesNotExist:
        pass

    try:
        resp = httpx.get(
            f"{LL2_BASE}/launch/{api_id}/",
            params={"mode": "detailed"},
            timeout=15,
        )
        resp.raise_for_status()
        parsed = _parse_launch(noaa_data := resp.json())
        obj, _ = Launch.objects.update_or_create(api_id=api_id, defaults=parsed)
        return obj
    except Exception:
        return Launch.objects.filter(api_id=api_id).first()
