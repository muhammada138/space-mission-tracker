import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from launches.models import Launch
from .models import LaunchPrediction

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def test_user():
    user, _ = User.objects.get_or_create(username='testuser', defaults={'password': 'password123'})
    return user

@pytest.fixture
def auth_client(test_user):
    client = APIClient()
    client.force_authenticate(user=test_user)
    return client

@pytest.fixture
def auth_client2():
    user, _ = User.objects.get_or_create(username='testuser2', defaults={'password': 'password123'})
    client = APIClient()
    client.force_authenticate(user=user)
    return client

@pytest.fixture
def launch():
    return Launch.objects.create(
        api_id="test_launch_123",
        name="Test Launch"
    )

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


# ── Launch Predictions Tests ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_prediction_get_unauthenticated(api_client, launch, test_user):
    # Create some predictions
    LaunchPrediction.objects.create(user=test_user, launch=launch, prediction='on_time')

    response = api_client.get(f'/api/watchlist/predictions/{launch.api_id}/')
    assert response.status_code == 200
    assert response.data['on_time'] == 1
    assert response.data['delayed'] == 0
    assert response.data['scrubbed'] == 0
    assert response.data['user_vote'] is None

@pytest.mark.django_db
def test_prediction_get_authenticated(auth_client, auth_client2, launch, test_user):
    # User 1 votes on_time
    LaunchPrediction.objects.create(user=test_user, launch=launch, prediction='on_time')

    # User 2 votes delayed
    user2 = User.objects.get(username='testuser2')
    LaunchPrediction.objects.create(user=user2, launch=launch, prediction='delayed')

    response = auth_client.get(f'/api/watchlist/predictions/{launch.api_id}/')
    assert response.status_code == 200
    assert response.data['on_time'] == 1
    assert response.data['delayed'] == 1
    assert response.data['scrubbed'] == 0
    assert response.data['user_vote'] == 'on_time'

@pytest.mark.django_db
def test_prediction_get_no_launch(api_client):
    response = api_client.get('/api/watchlist/predictions/nonexistent_launch/')
    assert response.status_code == 200
    assert response.data['on_time'] == 0
    assert response.data['delayed'] == 0
    assert response.data['scrubbed'] == 0
    assert response.data['user_vote'] is None

@pytest.mark.django_db
def test_prediction_post_unauthenticated(api_client, launch):
    response = api_client.post(f'/api/watchlist/predictions/{launch.api_id}/', {'prediction': 'on_time'})
    assert response.status_code == 401

@pytest.mark.django_db
def test_prediction_post_invalid_value(auth_client, launch):
    response = auth_client.post(f'/api/watchlist/predictions/{launch.api_id}/', {'prediction': 'invalid'})
    assert response.status_code == 400
    assert 'Invalid prediction value' in response.data['detail']

@pytest.mark.django_db
@patch('watchlist.views.get_launch_by_api_id')
def test_prediction_post_nonexistent_launch(mock_get_launch, auth_client):
    mock_get_launch.return_value = None
    response = auth_client.post('/api/watchlist/predictions/bad_id/', {'prediction': 'on_time'})
    assert response.status_code == 404
    assert 'Launch not found' in response.data['detail']

@pytest.mark.django_db
@patch('watchlist.views.get_launch_by_api_id')
def test_prediction_post_create_update(mock_get_launch, auth_client, launch):
    mock_get_launch.return_value = launch

    # Create new vote
    response = auth_client.post(f'/api/watchlist/predictions/{launch.api_id}/', {'prediction': 'on_time'})
    assert response.status_code == 200
    assert response.data['prediction'] == 'on_time'
    assert response.data['created'] is True

    # Update existing vote
    response = auth_client.post(f'/api/watchlist/predictions/{launch.api_id}/', {'prediction': 'delayed'})
    assert response.status_code == 200
    assert response.data['prediction'] == 'delayed'
    assert response.data['created'] is False

    # Check GET reflects update
    response_get = auth_client.get(f'/api/watchlist/predictions/{launch.api_id}/')
    assert response_get.data['on_time'] == 0
    assert response_get.data['delayed'] == 1
    assert response_get.data['user_vote'] == 'delayed'
