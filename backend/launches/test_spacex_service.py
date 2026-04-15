import pytest
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta
from launches.models import Launch
from launches.spacex_service import get_spacex_upcoming_launches, CACHE_TTL_MINUTES

@pytest.mark.django_db
def test_spacex_upcoming_launches_cache_hit():
    """Test that cache is used if >= 5 valid launches exist in the DB."""
    # Create 5 valid upcoming launches
    future_date = timezone.now() + timedelta(days=1)

    for i in range(5):
        Launch.objects.create(
            api_id=f'spacex_cache_{i}',
            name=f'Test Launch {i}',
            launch_provider='SpaceX',
            launch_date=future_date,
            last_fetched=timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES // 2)
        )

    # httpx.get should not be called due to cache hit
    with patch('httpx.get') as mock_get:
        mock_get.side_effect = Exception("API should not be called!")

        launches = get_spacex_upcoming_launches()

        assert len(launches) == 5
        assert all(l.api_id.startswith('spacex_cache_') for l in launches)
        mock_get.assert_not_called()

@pytest.mark.django_db
def test_spacex_upcoming_launches_api_fetch():
    """Test fetching from the API and upserting into the DB."""
    # Ensure cache is missed by having < 5 items
    future_date = (timezone.now() + timedelta(days=1)).isoformat()

    # Mock httpx.get to return 3 different endpoints based on URL
    def mock_httpx_get(url, *args, **kwargs):
        class MockResponse:
            def __init__(self, json_data):
                self._json_data = json_data

            def raise_for_status(self):
                pass

            def json(self):
                return self._json_data

        if url.endswith('/rockets'):
            return MockResponse([{'id': 'rocket1', 'name': 'Falcon 9'}])
        elif url.endswith('/launchpads'):
            return MockResponse([{'id': 'pad1', 'name': 'KSC', 'locality': 'Florida', 'region': 'USA'}])
        elif url.endswith('/launches/upcoming'):
            return MockResponse([
                {
                    'id': 'api_1',
                    'name': 'API Launch 1',
                    'date_utc': future_date,
                    'rocket': 'rocket1',
                    'launchpad': 'pad1',
                    'upcoming': True,
                    'links': {},
                    'details': 'A cool mission'
                }
            ])
        raise ValueError(f"Unexpected URL: {url}")

    with patch('httpx.get', side_effect=mock_httpx_get):
        launches = get_spacex_upcoming_launches()

        assert len(launches) == 1
        assert launches[0].api_id == 'spacex_api_1'
        assert launches[0].name == 'API Launch 1'
        assert launches[0].rocket == 'Falcon 9'
        assert launches[0].pad_name == 'KSC'

@pytest.mark.django_db
def test_spacex_upcoming_launches_no_future():
    """Test when the API returns only stale/past launches."""
    past_date = (timezone.now() - timedelta(days=1)).isoformat()

    def mock_httpx_get(url, *args, **kwargs):
        class MockResponse:
            def __init__(self, json_data):
                self._json_data = json_data

            def raise_for_status(self):
                pass

            def json(self):
                return self._json_data

        if url.endswith('/rockets') or url.endswith('/launchpads'):
            return MockResponse([])
        elif url.endswith('/launches/upcoming'):
            return MockResponse([
                {
                    'id': 'stale_1',
                    'name': 'Stale Launch',
                    'date_utc': past_date,
                    'upcoming': True
                }
            ])
        raise ValueError(f"Unexpected URL: {url}")

    with patch('httpx.get', side_effect=mock_httpx_get):
        launches = get_spacex_upcoming_launches()
        assert launches == []

@pytest.mark.django_db
def test_spacex_upcoming_launches_api_failure_fallback():
    """Test fallback to DB when API raises an exception."""
    future_date = timezone.now() + timedelta(days=1)

    # Create 2 valid upcoming launches
    for i in range(2):
        Launch.objects.create(
            api_id=f'spacex_fallback_{i}',
            name=f'Fallback Launch {i}',
            launch_provider='SpaceX',
            launch_date=future_date,
            last_fetched=timezone.now() - timedelta(minutes=CACHE_TTL_MINUTES // 2)
        )

    # Make API raise an exception
    with patch('httpx.get', side_effect=Exception("API is down!")):
        launches = get_spacex_upcoming_launches()

        # It should return the 2 fallback launches
        assert len(launches) == 2
        assert all(l.api_id.startswith('spacex_fallback_') for l in launches)
