import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta

from launches.models import Launch
from launches.services import get_past_launches, CACHE_TTL_MINUTES


@pytest.fixture
def mock_httpx_get():
    with patch("launches.services.httpx.get") as mock_get:
        yield mock_get


@pytest.mark.django_db
def test_get_past_launches_cache_hit(mock_httpx_get):
    """Test get_past_launches uses DB cache when fresh data exists."""
    now = timezone.now()
    # Create a fresh past launch in DB
    launch = Launch.objects.create(
        api_id="ll2_123",
        name="Past Launch 1",
        launch_date=now - timedelta(days=1),
    )
    # Update last_fetched directly to avoid auto_now
    Launch.objects.filter(id=launch.id).update(
        last_fetched=now - timedelta(minutes=10)  # Less than CACHE_TTL_MINUTES
    )

    # Exclude SpaceX launches explicitly to check filtering
    launch_spacex = Launch.objects.create(
        api_id="spacex_123",
        name="SpaceX Past",
        launch_date=now - timedelta(days=1),
    )
    Launch.objects.filter(id=launch_spacex.id).update(
        last_fetched=now - timedelta(minutes=10)
    )

    launches = get_past_launches(limit=5)

    # Should not call httpx
    mock_httpx_get.assert_not_called()

    # Should only return the LL2 launch, not SpaceX
    assert len(launches) == 1
    assert launches[0].api_id == "ll2_123"


@pytest.mark.django_db
def test_get_past_launches_api_success(mock_httpx_get):
    """Test get_past_launches calls API and upserts on cache miss."""
    # Setup mock response
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {
        "results": [
            {
                "id": "ll2_api_1",
                "name": "API Past Launch",
                "net": (timezone.now() - timedelta(days=2)).isoformat(),
                "status": {"name": "Success"},
            }
        ]
    }
    mock_httpx_get.return_value = mock_response

    # Start with empty DB
    assert Launch.objects.count() == 0

    launches = get_past_launches(limit=5)

    # Should call httpx
    mock_httpx_get.assert_called_once()

    # Should return the upserted launch
    assert len(launches) == 1
    assert launches[0].api_id == "ll2_api_1"
    assert launches[0].name == "API Past Launch"

    # Should have saved to DB
    assert Launch.objects.count() == 1


@pytest.mark.django_db
def test_get_past_launches_api_failure_fallback(mock_httpx_get):
    """Test get_past_launches falls back to stale DB data on API error."""
    now = timezone.now()
    # Create stale past launch in DB
    launch = Launch.objects.create(
        api_id="ll2_stale",
        name="Stale Launch",
        launch_date=now - timedelta(days=10),
    )
    # Older than CACHE_TTL_MINUTES, so auto_now override needs update
    Launch.objects.filter(id=launch.id).update(
        last_fetched=now - timedelta(minutes=CACHE_TTL_MINUTES + 10)
    )

    # Exclude SpaceX launches explicitly
    launch_spacex = Launch.objects.create(
        api_id="spacex_stale",
        name="SpaceX Stale",
        launch_date=now - timedelta(days=10),
    )
    Launch.objects.filter(id=launch_spacex.id).update(
        last_fetched=now - timedelta(minutes=CACHE_TTL_MINUTES + 10)
    )

    # Make API fail
    import httpx

    mock_httpx_get.side_effect = httpx.RequestError(
        "Network Error", request=MagicMock()
    )

    launches = get_past_launches(limit=5)

    # Should attempt to call httpx
    mock_httpx_get.assert_called_once()

    # Should return only the stale LL2 launch, not SpaceX
    assert len(launches) == 1
    assert launches[0].api_id == "ll2_stale"
