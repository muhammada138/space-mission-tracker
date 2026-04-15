import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
import httpx

from launches.models import Launch
from launches.services import get_launch_by_api_id, CACHE_TTL_MINUTES

@pytest.fixture
def mock_launch_data():
    return {
        'id': 'test-uuid-1234',
        'name': 'Test Launch',
        'net': '2025-01-01T00:00:00Z',
        'status': {'name': 'Go'},
        'launch_service_provider': {'name': 'Test Provider'},
        'rocket': {'configuration': {'name': 'Test Rocket'}},
    }

@pytest.mark.django_db
class TestGetLaunchByApiId:

    @patch('launches.spacex_service.get_spacex_launch_by_id')
    def test_routes_to_spacex_service(self, mock_spacex_service):
        """Test that requests with spacex_ prefix route to spacex_service."""
        mock_launch = MagicMock()
        mock_spacex_service.return_value = mock_launch

        result = get_launch_by_api_id('spacex_123')

        mock_spacex_service.assert_called_once_with('spacex_123')
        assert result == mock_launch

    @patch('httpx.get')
    def test_cache_hit(self, mock_get):
        """Test that a fresh cache hit returns the DB object without calling HTTPX."""
        # Create a fresh launch in the DB
        launch = Launch.objects.create(
            api_id='test-uuid-1234',
            name='Test Launch',
            last_fetched=timezone.now()
        )

        result = get_launch_by_api_id('test-uuid-1234')

        mock_get.assert_not_called()
        assert result.id == launch.id
        assert result.api_id == 'test-uuid-1234'

    @patch('httpx.get')
    def test_cache_hit_with_force_refresh(self, mock_get, mock_launch_data):
        """Test that force_refresh=True ignores the cache and fetches from HTTPX."""
        # Create a fresh launch in the DB
        Launch.objects.create(
            api_id='test-uuid-1234',
            name='Old Name',
            last_fetched=timezone.now()
        )

        # Setup mock HTTP response
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_launch_data
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        result = get_launch_by_api_id('test-uuid-1234', force_refresh=True)

        mock_get.assert_called_once()
        assert result.api_id == 'test-uuid-1234'
        assert result.name == 'Test Launch' # Updated from the mock data

    @patch('httpx.get')
    def test_cache_miss_successful_fetch(self, mock_get, mock_launch_data):
        """Test that a cache miss fetches from HTTPX and creates a DB object."""
        # Ensure DB is empty
        assert Launch.objects.count() == 0

        # Setup mock HTTP response
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_launch_data
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        result = get_launch_by_api_id('test-uuid-1234')

        mock_get.assert_called_once()
        assert result is not None
        assert result.api_id == 'test-uuid-1234'
        assert result.name == 'Test Launch'

        # Verify it was saved to the DB
        assert Launch.objects.filter(api_id='test-uuid-1234').exists()

    @patch('httpx.get')
    def test_cache_miss_failed_fetch(self, mock_get):
        """Test that a cache miss with an HTTP failure returns None."""
        # Ensure DB is empty
        assert Launch.objects.count() == 0

        # Setup mock HTTP response to raise an exception
        mock_request = MagicMock()
        mock_get.side_effect = httpx.RequestError("Network error", request=mock_request)

        result = get_launch_by_api_id('test-uuid-1234')

        mock_get.assert_called_once()
        assert result is None

    @patch('httpx.get')
    def test_cache_stale_failed_fetch_fallback(self, mock_get):
        """Test that a stale cache with an HTTP failure returns the stale DB object."""
        # Create a stale launch in the DB
        stale_time = timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES + 10)
        launch = Launch.objects.create(
            api_id='test-uuid-1234',
            name='Stale Launch'
        )
        # Update last_fetched directly to bypass auto_now=True if it exists
        Launch.objects.filter(id=launch.id).update(last_fetched=stale_time)

        # Setup mock HTTP response to raise an exception
        mock_request = MagicMock()
        mock_get.side_effect = httpx.RequestError("Network error", request=mock_request)

        result = get_launch_by_api_id('test-uuid-1234')

        mock_get.assert_called_once()
        # Should fallback to the DB object
        assert result is not None
        assert result.id == launch.id
        assert result.name == 'Stale Launch'
