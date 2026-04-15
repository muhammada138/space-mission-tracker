import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
from launches.models import Launch
from launches.spacex_service import get_spacex_upcoming_launches

@pytest.mark.django_db
@patch('launches.spacex_service.httpx.get')
def test_get_spacex_upcoming_launches_cache_hit(mock_get):
    """Test that it returns cached results and doesn't call API if we have >= 5 fresh future launches."""
    future_date = timezone.now() + timedelta(days=5)

    # Create 5 cached items
    for i in range(5):
        Launch.objects.create(
            api_id=f'spacex_mock_id_{i}',
            name=f'Mock Launch {i}',
            launch_date=future_date,
            # last_fetched is auto_now=True so it's fresh
        )

    launches = get_spacex_upcoming_launches()

    assert len(launches) == 5
    mock_get.assert_not_called()

@pytest.mark.django_db
@patch('launches.spacex_service._get_rockets_map')
@patch('launches.spacex_service._get_launchpads_map')
@patch('launches.spacex_service.httpx.get')
def test_get_spacex_upcoming_launches_api_success(mock_get, mock_pads, mock_rockets):
    """Test that it fetches from the API when cache is missing, maps data, and creates DB objects."""
    # Ensure cache is empty
    assert Launch.objects.count() == 0

    mock_rockets.return_value = {'rocket1': 'Falcon 9'}
    mock_pads.return_value = {'pad1': {'name': 'LC-39A', 'locality': 'Cape Canaveral', 'region': 'Florida'}}

    future_date_str = (timezone.now() + timedelta(days=1)).isoformat()

    mock_response = MagicMock()
    mock_response.json.return_value = [
        {
            'id': 'api_mock_1',
            'name': 'Test Future Launch',
            'date_utc': future_date_str,
            'rocket': 'rocket1',
            'launchpad': 'pad1',
            'upcoming': True,
        }
    ]
    mock_get.return_value = mock_response

    launches = get_spacex_upcoming_launches()

    assert len(launches) == 1
    assert Launch.objects.count() == 1

    launch = launches[0]
    assert launch.api_id == 'spacex_api_mock_1'
    assert launch.name == 'Test Future Launch'
    assert launch.rocket == 'Falcon 9'
    assert launch.pad_name == 'LC-39A'
    assert launch.pad_location == 'Cape Canaveral, Florida'
    assert launch.status == 'Go for Launch'

@pytest.mark.django_db
@patch('launches.spacex_service._get_rockets_map')
@patch('launches.spacex_service._get_launchpads_map')
@patch('launches.spacex_service.httpx.get')
def test_get_spacex_upcoming_launches_no_actual_future_launches(mock_get, mock_pads, mock_rockets):
    """Test that it filters out 'upcoming' launches with past dates."""
    mock_rockets.return_value = {}
    mock_pads.return_value = {}

    past_date_str = (timezone.now() - timedelta(days=1)).isoformat()

    mock_response = MagicMock()
    mock_response.json.return_value = [
        {
            'id': 'api_mock_past',
            'name': 'Test Past Launch',
            'date_utc': past_date_str,
            'upcoming': True,
        }
    ]
    mock_get.return_value = mock_response

    launches = get_spacex_upcoming_launches()

    assert len(launches) == 0
    assert Launch.objects.count() == 0

@pytest.mark.django_db
@patch('launches.spacex_service.httpx.get')
def test_get_spacex_upcoming_launches_api_failure(mock_get):
    """Test that it catches API exceptions and falls back to whatever is in the DB."""
    future_date = timezone.now() + timedelta(days=5)

    # Create 2 cached items (not enough to trigger the count >= 5 short circuit)
    for i in range(2):
        Launch.objects.create(
            api_id=f'spacex_mock_id_{i}',
            name=f'Mock Launch {i}',
            launch_date=future_date,
        )

    mock_get.side_effect = Exception("API is down")

    launches = get_spacex_upcoming_launches()

    assert len(launches) == 2
