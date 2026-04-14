import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_client():
    user = User.objects.create_user(username='testuser', password='password123')
    client = APIClient()
    client.force_authenticate(user=user)
    return client

@pytest.mark.django_db
def test_watchlist_unauthenticated(api_client):
    response = api_client.get('/api/watchlist/')
    assert response.status_code == 401

@pytest.mark.django_db
def test_watchlist_authenticated(auth_client):
    response = auth_client.get('/api/watchlist/')
    assert response.status_code == 200
    assert isinstance(response.data, dict)
    assert 'results' in response.data

@pytest.mark.django_db
def test_mission_logs_unauthenticated(api_client):
    response = api_client.get('/api/watchlist/logs/')
    assert response.status_code == 401

@pytest.mark.django_db
def test_mission_logs_authenticated(auth_client):
    response = auth_client.get('/api/watchlist/logs/')
    assert response.status_code == 200
    assert isinstance(response.data, dict)
    assert 'results' in response.data
