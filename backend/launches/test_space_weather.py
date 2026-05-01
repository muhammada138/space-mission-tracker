import pytest
import httpx
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APIClient
from launches.views import SpaceWeatherView


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture(autouse=True)
def clear_weather_cache():
    SpaceWeatherView._cache = {"data": None, "expires": None}
    yield
    SpaceWeatherView._cache = {"data": None, "expires": None}


def mock_httpx_get_responses(
    kp_value=0, num_flares=0, noaa_fail=False, nasa_fail=False
):
    def side_effect(url, **kwargs):
        if "noaa.gov" in url:
            if noaa_fail:
                raise Exception("NOAA failed")
            response = MagicMock()
            response.status_code = 200
            # SpaceWeatherView checks the last 60 minutes
            response.json.return_value = [{"kp_index": kp_value} for _ in range(60)]
            return response
        elif "nasa.gov" in url:
            if nasa_fail:
                raise Exception("NASA failed")
            response = MagicMock()
            response.status_code = 200
            response.json.return_value = [
                {"flrID": f"flr{i}"} for i in range(num_flares)
            ]
            return response
        return MagicMock()

    return side_effect


@patch.dict('os.environ', {'NASA_API_KEY': 'testkey'})
@pytest.mark.django_db
class TestSpaceWeatherView:

    def test_caching(self, api_client):
        url = reverse("space-weather")

        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=1, num_flares=1)
        ) as mock_get:
            # First request - should fetch data
            response1 = api_client.get(url)
            assert response1.status_code == 200
            assert mock_get.call_count == 2  # NOAA and NASA

            # Second request - should use cache
            response2 = api_client.get(url)
            assert response2.status_code == 200
            assert mock_get.call_count == 2  # Count shouldn't increase

            assert response1.data == response2.data

    def test_nominal_level_quiet(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=1, num_flares=1)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "nominal"
            assert response.data["label"] == "Quiet"
            assert response.data["kp"] == 1
            assert response.data["flares"] == 1

    def test_nominal_level_unsettled(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=2, num_flares=1)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "nominal"
            assert response.data["label"] == "Unsettled"
            assert response.data["kp"] == 2

    def test_moderate_level_by_kp(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=4, num_flares=1)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "moderate"
            assert response.data["label"] == "Moderate Activity"
            assert response.data["kp"] == 4

    def test_moderate_level_by_flares(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=1, num_flares=3)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "moderate"
            assert response.data["label"] == "Moderate Activity"
            assert response.data["flares"] == 3

    def test_severe_level_by_kp(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=7, num_flares=1)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "severe"
            assert response.data["label"] == "Storm Active"
            assert response.data["kp"] == 7

    def test_severe_level_by_flares(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get", side_effect=mock_httpx_get_responses(kp_value=1, num_flares=6)
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "severe"
            assert response.data["label"] == "Storm Active"
            assert response.data["flares"] == 6

    def test_noaa_failure(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get",
            side_effect=mock_httpx_get_responses(num_flares=1, noaa_fail=True),
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["kp"] == 0
            assert response.data["flares"] == 1

    def test_nasa_failure(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get",
            side_effect=mock_httpx_get_responses(kp_value=1, nasa_fail=True),
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["kp"] == 1
            assert response.data["flares"] == 0

    def test_both_failures(self, api_client):
        url = reverse("space-weather")
        with patch(
            "httpx.get",
            side_effect=mock_httpx_get_responses(noaa_fail=True, nasa_fail=True),
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["kp"] == 0
            assert response.data["flares"] == 0
            assert response.data["level"] == "nominal"
            assert response.data["label"] == "Quiet"

    def test_overall_exception(self, api_client):
        url = reverse("space-weather")
        with patch(
            "os.environ.get", side_effect=Exception("Environment variable error")
        ):
            response = api_client.get(url)
            assert response.status_code == 200
            assert response.data["level"] == "nominal"
            assert response.data["label"] == "Data Unavailable"
            assert response.data["error"] == "Environment variable error"
