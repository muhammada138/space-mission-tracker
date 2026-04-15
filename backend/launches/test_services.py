import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
import httpx

from launches.models import Launch
from launches.services import get_upcoming_launches


@pytest.mark.django_db
class TestGetUpcomingLaunches:
    def test_cache_hit(self):
        # Create 10 valid upcoming launches
        now = timezone.now()
        for i in range(10):
            Launch.objects.create(
                api_id=f"test_id_{i}",
                name=f"Test Launch {i}",
                launch_date=now + timedelta(days=1, hours=i),
                # last_fetched is auto_now=True, so it will be "now"
            )

        with patch("launches.services.httpx.get") as mock_get:
            launches = get_upcoming_launches(limit=5)

            # Should return 5 results from cache
            assert len(launches) == 5
            # Ensure it didn't call the API
            mock_get.assert_not_called()

    def test_cache_miss_api_success(self):
        # We start with 0 launches in the DB
        mock_api_data = {
            "results": [
                {
                    "id": "new_api_id_1",
                    "name": "New API Launch",
                    "net": (timezone.now() + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    "status": {"name": "Go"},
                    "rocket": {"configuration": {"name": "Falcon 9"}},
                    "launch_service_provider": {"name": "SpaceX"}
                }
            ]
        }

        with patch("launches.services.httpx.get") as mock_get:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_api_data
            mock_get.return_value = mock_response

            launches = get_upcoming_launches(limit=5)

            mock_get.assert_called_once()
            assert len(launches) == 1
            assert launches[0].api_id == "new_api_id_1"
            assert launches[0].name == "New API Launch"

            # Verify it's actually in the database now
            assert Launch.objects.filter(api_id="new_api_id_1").exists()

    def test_api_failure_fallback(self):
        now = timezone.now()
        # Create just 1 launch (less than the 10 required for a cache hit)
        Launch.objects.create(
            api_id="fallback_id",
            name="Fallback Launch",
            launch_date=now + timedelta(days=1)
        )

        with patch("launches.services.httpx.get") as mock_get:
            mock_get.side_effect = httpx.HTTPError("API Down")

            launches = get_upcoming_launches()

            # Even though API failed, we should still get our DB launch
            assert len(launches) == 1
            assert launches[0].api_id == "fallback_id"

    def test_excludes_spacex_launches(self):
        now = timezone.now()
        # Create 11 spacex launches, these should not count towards cache
        for i in range(11):
            Launch.objects.create(
                api_id=f"spacex_{i}",
                name=f"SpaceX Launch {i}",
                launch_date=now + timedelta(days=1, hours=i)
            )

        mock_api_data = {
            "results": [
                {
                    "id": "non_spacex_api",
                    "name": "Non SpaceX API Launch",
                    "net": (timezone.now() + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    "status": {"name": "Go"},
                    "rocket": {"configuration": {"name": "Falcon 9"}},
                    "launch_service_provider": {"name": "SpaceX"}
                }
            ]
        }

        with patch("launches.services.httpx.get") as mock_get:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_api_data
            mock_get.return_value = mock_response

            launches = get_upcoming_launches()

            # Because we excluded spacex_ prefixed, we had < 10 cached, so we hit API
            mock_get.assert_called_once()

            assert len(launches) == 1
            assert launches[0].api_id == "non_spacex_api"

            # Let's also test the fallback branch when API fails but we have non-spacex and spacex launches.
            mock_get.side_effect = httpx.HTTPError("API Down")

            Launch.objects.create(
                api_id="non_spacex_db",
                name="Non SpaceX DB Launch",
                launch_date=now + timedelta(days=1)
            )

            fallback_launches = get_upcoming_launches()
            # We have 1 non-spacex and 11 spacex. The spacex should be excluded.
            # The fallback query is Launch.objects.filter(...).exclude(api_id__startswith='spacex_')
            assert len(fallback_launches) == 2 # "non_spacex_api" (upserted previously) and "non_spacex_db"
            assert all(not l.api_id.startswith('spacex_') for l in fallback_launches)
