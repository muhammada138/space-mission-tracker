import httpx
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APIClient
from launches.models import Launch
from launches.views import LaunchPadWeatherView

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_upcoming_launches_all_source(api_client):
    with patch('launches.views.get_upcoming_launches') as mock_ll2, \
         patch('launches.views.get_spacex_upcoming_launches') as mock_spacex:
        
        # We can just return standard django model instances or dicts. 
        # But wait, get_upcoming_launches normally returns Launch objects.
        # It's easier just to mock them to return empty lists to verify 200 OK
        # and that the endpoint structure hasn't broken.
        mock_ll2.return_value = []
        mock_spacex.return_value = []
        
        response = api_client.get('/api/launches/upcoming/')
        assert response.status_code == 200
        assert isinstance(response.data, list)
        
        mock_ll2.assert_called_once()
        mock_spacex.assert_called_once()

@pytest.mark.django_db
def test_past_launches(api_client):
    with patch('launches.views.get_past_launches') as mock_ll2, \
         patch('launches.views.get_spacex_past_launches') as mock_spacex:
        
        mock_ll2.return_value = []
        mock_spacex.return_value = []
        
        response = api_client.get('/api/launches/past/')
        assert response.status_code == 200
        assert isinstance(response.data, list)

@pytest.mark.django_db
def test_active_launches(api_client):
    with patch('httpx.get') as mock_httpx_get:
        response = api_client.get('/api/launches/active/')
        assert response.status_code in [200, 503]
        if response.status_code == 200:
            assert isinstance(response.data, list)

@pytest.fixture
def clear_weather_cache():
    LaunchPadWeatherView._cache.clear()
    yield
    LaunchPadWeatherView._cache.clear()

@pytest.mark.django_db
def test_launch_pad_weather_not_found(api_client, clear_weather_cache):
    response = api_client.get('/api/launches/nonexistent_id/pad-weather/')
    assert response.status_code == 404
    assert response.data['detail'] == 'Launch not found.'

@pytest.mark.django_db
def test_launch_pad_weather_no_coordinates(api_client, clear_weather_cache):
    Launch.objects.create(api_id="no_coord", name="No Coord Launch")
    response = api_client.get('/api/launches/no_coord/pad-weather/')
    assert response.status_code == 404
    assert response.data['detail'] == 'No coordinates for this pad.'

@pytest.mark.django_db
def test_launch_pad_weather_owm(api_client, clear_weather_cache, monkeypatch):
    Launch.objects.create(api_id="owm_launch", name="OWM Launch", pad_latitude=28.5, pad_longitude=-80.6)
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test_key")

    class MockResponse:
        def __init__(self):
            self.status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return {
                "wind": {"speed": 5.0},
                "visibility": 10000,
                "main": {"temp": 25, "humidity": 60},
                "weather": [{"description": "clear sky", "icon": "01d", "main": "Clear"}]
            }

    with patch('httpx.get', return_value=MockResponse()) as mock_get:
        response = api_client.get('/api/launches/owm_launch/pad-weather/')
        assert response.status_code == 200
        assert response.data['source'] == 'OpenWeatherMap'
        assert response.data['available'] is True
        mock_get.assert_called_once()

@pytest.mark.django_db
def test_launch_pad_weather_openmeteo(api_client, clear_weather_cache, monkeypatch):
    Launch.objects.create(api_id="om_launch", name="OM Launch", pad_latitude=28.5, pad_longitude=-80.6)
    monkeypatch.delenv("OPENWEATHERMAP_API_KEY", raising=False)

    class MockResponse:
        def __init__(self):
            self.status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return {
                "current_weather": {
                    "temperature": 22,
                    "windspeed": 15,
                    "weathercode": 0
                }
            }

    with patch('httpx.get', return_value=MockResponse()) as mock_get:
        response = api_client.get('/api/launches/om_launch/pad-weather/')
        assert response.status_code == 200
        assert response.data['source'] == 'Open-Meteo'
        assert response.data['available'] is True
        mock_get.assert_called_once()

@pytest.mark.django_db
def test_launch_pad_weather_exception(api_client, clear_weather_cache, monkeypatch):
    Launch.objects.create(api_id="err_launch", name="Err Launch", pad_latitude=28.5, pad_longitude=-80.6)
    monkeypatch.delenv("OPENWEATHERMAP_API_KEY", raising=False)

    with patch('httpx.get', side_effect=httpx.RequestError("Network error", request=httpx.Request("GET", "https://example.com"))) as mock_get:
        response = api_client.get('/api/launches/err_launch/pad-weather/')
        assert response.status_code == 503
        assert response.data['available'] is False
        assert "Network error" in response.data['reason']

@pytest.mark.django_db
def test_launch_pad_weather_cache(api_client, clear_weather_cache, monkeypatch):
    Launch.objects.create(api_id="cache_launch", name="Cache Launch", pad_latitude=28.5, pad_longitude=-80.6)
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test_key")

    class MockResponse:
        def __init__(self):
            self.status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return {
                "wind": {"speed": 5.0},
                "visibility": 10000,
                "main": {"temp": 25, "humidity": 60},
                "weather": [{"description": "clear sky", "icon": "01d", "main": "Clear"}]
            }

    with patch('httpx.get', return_value=MockResponse()) as mock_get:
        # First call should hit the mocked API
        response1 = api_client.get('/api/launches/cache_launch/pad-weather/')
        assert response1.status_code == 200

        # Second call should use cache
        response2 = api_client.get('/api/launches/cache_launch/pad-weather/')
        assert response2.status_code == 200

        # The mock should only have been called once
        mock_get.assert_called_once()
