import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APIClient

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

from launches.views import SpaceWeatherView

@pytest.fixture
def clear_space_weather_cache():
    SpaceWeatherView._cache = {'data': None, 'expires': None}
    yield
    SpaceWeatherView._cache = {'data': None, 'expires': None}

@pytest.mark.django_db
class TestSpaceWeatherView:
    def test_happy_path(self, api_client, clear_space_weather_cache):
        with patch('httpx.get') as mock_get:
            # We need to mock httpx.get to return different responses based on the URL
            def side_effect(url, *args, **kwargs):
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                if 'noaa' in url:
                    mock_resp.json.return_value = [{'kp_index': 5}]
                elif 'nasa' in url:
                    mock_resp.json.return_value = [{}, {}, {}] # 3 flares
                return mock_resp
            mock_get.side_effect = side_effect

            response = api_client.get('/api/space-weather/')
            assert response.status_code == 200
            assert response.data['kp'] == 5
            assert response.data['flares'] == 3
            assert response.data['level'] == 'moderate'
            assert response.data['label'] == 'Moderate Activity'
            assert mock_get.call_count == 2

    def test_noaa_fails_nasa_succeeds(self, api_client, clear_space_weather_cache):
        with patch('httpx.get') as mock_get:
            def side_effect(url, *args, **kwargs):
                if 'noaa' in url:
                    raise Exception("NOAA Error")
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                if 'nasa' in url:
                    mock_resp.json.return_value = [{}, {}, {}, {}, {}, {}] # 6 flares
                return mock_resp
            mock_get.side_effect = side_effect

            response = api_client.get('/api/space-weather/')
            assert response.status_code == 200
            assert response.data['kp'] == 0
            assert response.data['flares'] == 6
            assert response.data['level'] == 'severe'
            assert response.data['label'] == 'Storm Active'

    def test_nasa_fails_noaa_succeeds(self, api_client, clear_space_weather_cache):
        with patch('httpx.get') as mock_get:
            def side_effect(url, *args, **kwargs):
                if 'nasa' in url:
                    raise Exception("NASA Error")
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                if 'noaa' in url:
                    mock_resp.json.return_value = [{'kp_index': 1}]
                return mock_resp
            mock_get.side_effect = side_effect

            response = api_client.get('/api/space-weather/')
            assert response.status_code == 200
            assert response.data['kp'] == 1
            assert response.data['flares'] == 0
            assert response.data['level'] == 'nominal'
            assert response.data['label'] == 'Quiet'

    def test_complete_api_failure(self, api_client, clear_space_weather_cache):
        with patch('httpx.get') as mock_get:
            mock_get.side_effect = Exception("Network Error")

            response = api_client.get('/api/space-weather/')
            assert response.status_code == 200
            assert response.data['kp'] == 0
            assert response.data['flares'] == 0
            assert response.data['level'] == 'nominal'
            assert response.data['label'] == 'Quiet'

    def test_caching_mechanism(self, api_client, clear_space_weather_cache):
        with patch('httpx.get') as mock_get:
            def side_effect(url, *args, **kwargs):
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                if 'noaa' in url:
                    mock_resp.json.return_value = [{'kp_index': 3}]
                elif 'nasa' in url:
                    mock_resp.json.return_value = []
                return mock_resp
            mock_get.side_effect = side_effect

            # First request - should call APIs
            response1 = api_client.get('/api/space-weather/')
            assert response1.status_code == 200
            assert mock_get.call_count == 2

            # Second request - should use cache
            response2 = api_client.get('/api/space-weather/')
            assert response2.status_code == 200
            assert response2.data == response1.data
            assert mock_get.call_count == 2 # call count unchanged

    def test_outer_exception_fallback(self, api_client, clear_space_weather_cache):
        with patch('os.environ.get') as mock_env:
            # Trigger the outer exception block
            mock_env.side_effect = Exception("Outer Error")

            response = api_client.get('/api/space-weather/')
            assert response.status_code == 200
            assert response.data['level'] == 'nominal'
            assert response.data['label'] == 'Data Unavailable'
            assert response.data['error'] == 'Outer Error'
