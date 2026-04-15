import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
import httpx

from launches.models import Launch
from launches.services import get_upcoming_launches

@pytest.fixture
def mock_launch_data():
    return {
        "id": "e3df2bpn-28b9-4d69-80ac-80d4db026027",
        "url": "https://ll.thespacedevs.com/2.2.0/launch/e3df2bpn-28b9-4d69-80ac-80d4db026027/",
        "slug": "falcon-9-block-5-starlink-group-6-35",
        "name": "Falcon 9 Block 5 | Starlink Group 6-35",
        "status": {"id": 1, "name": "Go", "abbrev": "Go", "description": "Launch is GO"},
        "last_updated": "2023-12-07T12:00:00Z",
        "net": (timezone.now() + timedelta(days=1)).isoformat(),
        "rocket": {
            "configuration": {
                "id": 164,
                "name": "Falcon 9",
                "full_name": "Falcon 9 Block 5"
            }
        },
        "launch_service_provider": {
            "id": 121,
            "name": "SpaceX"
        },
        "mission": {
            "description": "A batch of Starlink satellites",
            "type": "Communications",
            "orbit": {"name": "Low Earth Orbit"}
        },
        "pad": {
            "name": "Space Launch Complex 40",
            "location": {
                "name": "Cape Canaveral SFS, FL, USA"
            },
            "latitude": "28.56194122",
            "longitude": "-80.57735736"
        },
        "image": "https://example.com/image.jpg",
    }


@pytest.mark.django_db
def test_get_upcoming_launches_uses_cache():
    """Test that cache is used if there are 10 or more fresh future launches."""
    future_date = timezone.now() + timedelta(days=2)
    # Create 10 launches to trigger cache branch
    for i in range(10):
        Launch.objects.create(
            api_id=f'test_launch_{i}',
            name=f'Test Launch {i}',
            launch_date=future_date
        )

    with patch('launches.services.httpx.get') as mock_httpx_get:
        launches = get_upcoming_launches(limit=20)

        # httpx should not be called
        mock_httpx_get.assert_not_called()

        # We should get exactly 10 back since we asked for up to 20
        assert len(launches) == 10
        assert launches[0].name == 'Test Launch 0'


@pytest.mark.django_db
def test_get_upcoming_launches_calls_api_when_cache_miss(mock_launch_data):
    """Test that the API is called if there are fewer than 10 fresh future launches."""
    # We start with 0 launches in the DB
    with patch('launches.services.httpx.get') as mock_httpx_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": [mock_launch_data]}
        mock_httpx_get.return_value = mock_resp

        launches = get_upcoming_launches(limit=20)

        mock_httpx_get.assert_called_once()
        assert len(launches) == 1
        assert launches[0].api_id == mock_launch_data["id"]
        assert launches[0].name == mock_launch_data["name"]

        # Ensure it was saved to DB
        assert Launch.objects.count() == 1


@pytest.mark.django_db
def test_get_upcoming_launches_api_failure_fallback():
    """Test fallback to DB when API raises an exception."""
    future_date = timezone.now() + timedelta(days=1)
    # Create 2 launches so cache miss occurs (needs >= 10 to use cache without API)
    Launch.objects.create(api_id='test_1', name='Launch 1', launch_date=future_date)
    Launch.objects.create(api_id='test_2', name='Launch 2', launch_date=future_date)

    with patch('launches.services.httpx.get') as mock_httpx_get:
        # Simulate network failure
        mock_httpx_get.side_effect = httpx.RequestError("Network error")

        launches = get_upcoming_launches(limit=20)

        mock_httpx_get.assert_called_once()

        # Should return the 2 available launches from DB
        assert len(launches) == 2
        assert launches[0].name == 'Launch 1'


@pytest.mark.django_db
def test_get_upcoming_launches_api_empty_results_fallback():
    """Test fallback to DB when API returns successful empty results."""
    future_date = timezone.now() + timedelta(days=1)
    Launch.objects.create(api_id='test_1', name='Launch 1', launch_date=future_date)

    with patch('launches.services.httpx.get') as mock_httpx_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": []}
        mock_httpx_get.return_value = mock_resp

        launches = get_upcoming_launches(limit=20)

        mock_httpx_get.assert_called_once()

        # Should return the 1 available launch from DB
        assert len(launches) == 1
        assert launches[0].name == 'Launch 1'

@pytest.mark.django_db
def test_get_upcoming_launches_excludes_spacex():
    """Test that SpaceX launches are excluded from the results."""
    future_date = timezone.now() + timedelta(days=2)
    # Create valid LL2 launch
    Launch.objects.create(api_id='test_ll2', name='LL2 Launch', launch_date=future_date)
    # Create SpaceX launch
    Launch.objects.create(api_id='spacex_test', name='SpaceX Launch', launch_date=future_date)

    # Needs to be 10 for cache, let's create 9 more LL2
    for i in range(9):
        Launch.objects.create(api_id=f'test_ll2_{i}', name=f'LL2 Launch {i}', launch_date=future_date)

    with patch('launches.services.httpx.get') as mock_httpx_get:
        launches = get_upcoming_launches(limit=20)

        # SpaceX should not be in the results
        assert len(launches) == 10
        assert all(not l.api_id.startswith('spacex_') for l in launches)
