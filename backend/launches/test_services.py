import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
import httpx

from launches.models import Launch
from launches.services import get_launch_by_api_id

@pytest.fixture
def mock_httpx_get():
    with patch('httpx.get') as mock_get:
        yield mock_get

@pytest.fixture
def mock_spacex_service():
    with patch('launches.spacex_service.get_spacex_launch_by_id') as mock_spacex:
        yield mock_spacex

@pytest.mark.django_db
class TestGetLaunchByApiId:

    def test_spacex_prefix_delegates_to_spacex_service(self, mock_spacex_service):
        mock_launch = Launch(api_id="spacex_123", name="SpaceX Test")
        mock_spacex_service.return_value = mock_launch

        result = get_launch_by_api_id("spacex_123")

        mock_spacex_service.assert_called_once_with("spacex_123")
        assert result == mock_launch

    def test_cache_hit_returns_fresh_db_object(self, mock_httpx_get):
        # Create a fresh launch in the DB
        launch = Launch.objects.create(api_id="ll2_123", name="Fresh Launch")
        # Ensure it's considered fresh by setting last_fetched to now
        Launch.objects.filter(id=launch.id).update(last_fetched=timezone.now())

        result = get_launch_by_api_id("ll2_123")

        mock_httpx_get.assert_not_called()
        assert result.id == launch.id
        assert result.name == "Fresh Launch"

    def test_cache_miss_stale_db_object_fetches_from_api(self, mock_httpx_get):
        # Create a stale launch in the DB
        launch = Launch.objects.create(api_id="ll2_123", name="Stale Launch")
        stale_time = timezone.now() - timedelta(minutes=130)  # > 120 minutes TTL
        Launch.objects.filter(id=launch.id).update(last_fetched=stale_time)

        # Setup mock API response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "id": "ll2_123",
            "name": "Updated Launch",
            "status": {"name": "Go"},
            "rocket": {"configuration": {"name": "Falcon 9"}},
            "launch_service_provider": {"name": "SpaceX"}
        }
        mock_httpx_get.return_value = mock_resp

        result = get_launch_by_api_id("ll2_123")

        mock_httpx_get.assert_called_once()
        assert result.id == launch.id
        assert result.name == "Updated Launch"
        assert Launch.objects.get(id=launch.id).name == "Updated Launch"

    def test_cache_miss_no_db_object_fetches_from_api(self, mock_httpx_get):
        # Setup mock API response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "id": "ll2_456",
            "name": "New Launch",
            "status": {"name": "Go"},
            "rocket": {"configuration": {"name": "Atlas V"}},
            "launch_service_provider": {"name": "ULA"}
        }
        mock_httpx_get.return_value = mock_resp

        # Ensure it doesn't exist yet
        assert not Launch.objects.filter(api_id="ll2_456").exists()

        result = get_launch_by_api_id("ll2_456")

        mock_httpx_get.assert_called_once()
        assert result.api_id == "ll2_456"
        assert result.name == "New Launch"
        assert Launch.objects.filter(api_id="ll2_456").exists()

    def test_force_refresh_fetches_from_api_even_if_fresh(self, mock_httpx_get):
        # Create a fresh launch in the DB
        launch = Launch.objects.create(api_id="ll2_123", name="Fresh Launch")
        Launch.objects.filter(id=launch.id).update(last_fetched=timezone.now())

        # Setup mock API response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "id": "ll2_123",
            "name": "Force Updated Launch",
            "status": {"name": "Go"},
            "rocket": {"configuration": {"name": "Falcon 9"}},
            "launch_service_provider": {"name": "SpaceX"}
        }
        mock_httpx_get.return_value = mock_resp

        result = get_launch_by_api_id("ll2_123", force_refresh=True)

        mock_httpx_get.assert_called_once()
        assert result.id == launch.id
        assert result.name == "Force Updated Launch"

    def test_api_failure_returns_db_object_if_exists(self, mock_httpx_get):
        # Create a stale launch in the DB
        launch = Launch.objects.create(api_id="ll2_123", name="Stale Launch")
        stale_time = timezone.now() - timedelta(minutes=130)
        Launch.objects.filter(id=launch.id).update(last_fetched=stale_time)

        # Setup mock API to raise an exception
        mock_httpx_get.side_effect = httpx.RequestError("API unavailable")

        result = get_launch_by_api_id("ll2_123")

        mock_httpx_get.assert_called_once()
        # Should return the stale object as fallback
        assert result.id == launch.id
        assert result.name == "Stale Launch"

    def test_api_failure_returns_none_if_no_db_object(self, mock_httpx_get):
        # Setup mock API to raise an exception
        mock_httpx_get.side_effect = httpx.RequestError("API unavailable")

        # Ensure it doesn't exist
        assert not Launch.objects.filter(api_id="ll2_789").exists()

        result = get_launch_by_api_id("ll2_789")

        mock_httpx_get.assert_called_once()
        assert result is None
