import httpx
import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from launches.models import Launch
from launches.views import LaunchPadWeatherView


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture(autouse=True)
def clear_weather_cache():
    LaunchPadWeatherView._cache.clear()
    yield
    LaunchPadWeatherView._cache.clear()


@pytest.mark.django_db
def test_upcoming_launches_all_source(api_client):
    with patch("launches.views.get_upcoming_launches") as mock_ll2, patch(
        "launches.views.get_spacex_upcoming_launches"
    ) as mock_spacex:

        # We can just return standard django model instances or dicts.
        # But wait, get_upcoming_launches normally returns Launch objects.
        # It's easier just to mock them to return empty lists to verify 200 OK
        # and that the endpoint structure hasn't broken.
        mock_ll2.return_value = []
        mock_spacex.return_value = []

        response = api_client.get("/api/launches/upcoming/")
        assert response.status_code == 200
        assert isinstance(response.data, list)

        mock_ll2.assert_called_once()
        mock_spacex.assert_called_once()


@pytest.mark.django_db
def test_past_launches(api_client):
    with patch("launches.views.get_past_launches") as mock_ll2, patch(
        "launches.views.get_spacex_past_launches"
    ) as mock_spacex:

        mock_ll2.return_value = []
        mock_spacex.return_value = []

        response = api_client.get("/api/launches/past/")
        assert response.status_code == 200
        assert isinstance(response.data, list)


@pytest.mark.django_db
def test_active_launches(api_client):
    with patch("httpx.get") as mock_httpx_get:
        response = api_client.get("/api/launches/active/")
        assert response.status_code in [200, 503]
        if response.status_code == 200:
            assert isinstance(response.data, list)


@pytest.mark.django_db
def test_active_launches_deduplication(api_client):
    """
    Tests that the ActiveLaunchesView successfully handles deduplication via the O(1)
    lookup mechanism when fetching recent successes and mapping them onto results.
    """
    from django.utils import timezone
    from datetime import timedelta

    now = timezone.now()

    # 1. Create a recent successful launch
    Launch.objects.create(
        api_id="duplicate_mission_1",
        name="Duplicate Mission",
        launch_date=now - timedelta(hours=1),
        status="Success",
        rocket="Falcon 9",
        launch_provider="SpaceX",
    )

    # 2. Mock the HTTP response such that it returns the EXACT SAME mission in the 'results'
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": [
            {
                "id": "duplicate_mission_1",
                "name": "Duplicate Mission",
                "net": (now - timedelta(hours=1)).isoformat(),
                "status": {"name": "In Flight", "abbrev": "In Flight"},
            }
        ]
    }

    with patch("httpx.get", return_value=mock_response), patch(
        "launches.services._upsert_launches"
    ) as mock_upsert:
        # We need to simulate that _upsert_launches returns the combined list of launches as objects
        # so we don't crash in `for l in launches:` later
        mock_upsert.return_value = [
            Launch(
                api_id="duplicate_mission_1",
                name="Duplicate Mission",
                launch_date=now - timedelta(hours=1),
                status="In Flight",
            )
        ]

        response = api_client.get("/api/launches/active/")

        assert response.status_code == 200

        # Verify that we only have ONE item in the result, meaning no duplication occurred
        data = response.json()
        assert len(data) == 1
        assert data[0].get("api_id") == "duplicate_mission_1"


@pytest.mark.django_db
def test_pad_weather_not_found(api_client):
    response = api_client.get("/api/launches/invalid_id/pad-weather/")
    assert response.status_code == 404
    assert response.data["detail"] == "Launch not found."


@pytest.mark.django_db
def test_pad_weather_no_coordinates(api_client):
    Launch.objects.create(api_id="no_coords_id", name="No Coords Launch")
    response = api_client.get("/api/launches/no_coords_id/pad-weather/")
    assert response.status_code == 404
    assert response.data["detail"] == "No coordinates for this pad."


@pytest.mark.django_db
def test_pad_weather_openweathermap_success(api_client):
    Launch.objects.create(
        api_id="test_id_owm",
        name="Test OWM Launch",
        pad_latitude=28.5,
        pad_longitude=-80.6,
    )

    mock_response = httpx.Response(
        200,
        request=httpx.Request("GET", "https://api.openweathermap.org/data/2.5/weather"),
        json={
            "wind": {"speed": 5.0},
            "visibility": 10000,
            "main": {"temp": 25, "humidity": 60},
            "weather": [{"description": "clear sky", "icon": "01d", "main": "Clear"}],
        },
    )

    with patch.dict("os.environ", {"OPENWEATHERMAP_API_KEY": "fake_api_key"}), patch(
        "httpx.get", return_value=mock_response
    ):
        response = api_client.get("/api/launches/test_id_owm/pad-weather/")
        assert response.status_code == 200
        assert response.data["available"] is True
        assert response.data["source"] == "OpenWeatherMap"
        assert response.data["description"] == "Clear Sky"


@pytest.mark.django_db
def test_pad_weather_openmeteo_success(api_client):
    Launch.objects.create(
        api_id="test_id_om",
        name="Test OM Launch",
        pad_latitude=28.5,
        pad_longitude=-80.6,
    )

    mock_response = httpx.Response(
        200,
        request=httpx.Request("GET", "https://api.open-meteo.com/v1/forecast"),
        json={
            "current_weather": {"temperature": 25, "windspeed": 10, "weathercode": 0}
        },
    )

    with patch.dict("os.environ", {"OPENWEATHERMAP_API_KEY": ""}), patch(
        "httpx.get", return_value=mock_response
    ):
        response = api_client.get("/api/launches/test_id_om/pad-weather/")
        assert response.status_code == 200
        assert response.data["available"] is True
        assert response.data["source"] == "Open-Meteo"
        assert response.data["description"] == "Clear Sky"


@pytest.mark.django_db
def test_pad_weather_api_error(api_client):
    Launch.objects.create(
        api_id="test_id_err",
        name="Test Error Launch",
        pad_latitude=28.5,
        pad_longitude=-80.6,
    )

    with patch.dict("os.environ", {"OPENWEATHERMAP_API_KEY": ""}), patch(
        "httpx.get",
        side_effect=httpx.RequestError(
            "Connection timeout",
            request=httpx.Request("GET", "https://api.open-meteo.com/v1/forecast"),
        ),
    ):
        response = api_client.get("/api/launches/test_id_err/pad-weather/")
        assert response.status_code == 503
        assert response.data["available"] is False
        assert "Connection timeout" in response.data["reason"]
