import pytest
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta
import httpx

from launches.models import Launch
from launches.spacex_service import get_spacex_past_launches


@pytest.mark.django_db
def test_get_spacex_past_launches_cache_hit():
    """Test that if we have a cached past launch within the TTL, we return it without API calls."""
    # Create a past launch that was just fetched
    now = timezone.now()
    past_date = now - timedelta(days=10)
    launch = Launch.objects.create(
        api_id="spacex_test1",
        name="Cached Past Launch",
        launch_date=past_date,
        # Default last_fetched is auto_now, so it will be "now", which is within the TTL
    )

    with patch("launches.spacex_service.httpx.get") as mock_get:
        results = get_spacex_past_launches(limit=20)

        # API should not be called
        mock_get.assert_not_called()

        # Result should be returned from DB
        assert len(results) == 1
        assert results[0].api_id == "spacex_test1"
        assert results[0].name == "Cached Past Launch"


@pytest.mark.django_db
def test_get_spacex_past_launches_api_fetch():
    """Test that if cache is empty or stale, we fetch from API and cache the results."""
    # Ensure no valid cached launches
    assert Launch.objects.count() == 0

    # Ensure format matches isoformat without Z appended incorrectly to an already timezone aware string
    past_date_str = (timezone.now() - timedelta(days=5)).isoformat()

    # Mock responses for rockets, launchpads, and past launches
    def mock_get(*args, **kwargs):
        class MockResponse:
            def __init__(self, json_data, status_code=200):
                self.json_data = json_data
                self.status_code = status_code

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise httpx.HTTPError(f"Error {self.status_code}")

            def json(self):
                return self.json_data

        url = args[0]
        if "/rockets" in url:
            return MockResponse([{"id": "rocket1", "name": "Falcon 9"}])
        elif "/launchpads" in url:
            return MockResponse(
                [
                    {
                        "id": "pad1",
                        "name": "LC-39A",
                        "locality": "Cape Canaveral",
                        "region": "Florida",
                    }
                ]
            )
        elif "/launches/past" in url:
            return MockResponse(
                [
                    {
                        "id": "test2",
                        "name": "API Past Launch",
                        "date_utc": past_date_str,
                        "rocket": "rocket1",
                        "launchpad": "pad1",
                        "success": True,
                        "details": "A successful mission",
                        "links": {
                            "patch": {"large": "http://image.url"},
                            "webcast": "http://webcast.url",
                        },
                    }
                ]
            )
        return MockResponse([])

    with patch("launches.spacex_service.httpx.get", side_effect=mock_get):
        results = get_spacex_past_launches(limit=20)

        # Result should contain the fetched launch
        assert len(results) == 1
        assert results[0].api_id == "spacex_test2"
        assert results[0].name == "API Past Launch"
        assert results[0].rocket == "Falcon 9"
        assert results[0].pad_name == "LC-39A"
        assert results[0].status == "Launch Successful"

        # It should also be saved in the database
        assert Launch.objects.filter(api_id="spacex_test2").exists()


@pytest.mark.django_db
def test_get_spacex_past_launches_api_failure_fallback():
    """Test that if the API fails, we return whatever stale cached data we have."""
    now = timezone.now()
    past_date = now - timedelta(days=20)
    stale_fetch_date = now - timedelta(days=2)  # Older than TTL

    # Create a stale past launch
    launch = Launch.objects.create(
        api_id="spacex_test_stale",
        name="Stale Past Launch",
        launch_date=past_date,
    )
    # Update last_fetched to be stale (auto_now bypasses create)
    Launch.objects.filter(api_id="spacex_test_stale").update(
        last_fetched=stale_fetch_date
    )

    # Force httpx.get to raise an exception
    with patch(
        "launches.spacex_service.httpx.get", side_effect=httpx.HTTPError("API Down")
    ):
        results = get_spacex_past_launches(limit=20)

        # Should fall back to the stale database record
        assert len(results) == 1
        assert results[0].api_id == "spacex_test_stale"
        assert results[0].name == "Stale Past Launch"
