import pytest
from rest_framework.test import APIClient
from django.core.cache import cache

@pytest.fixture(autouse=True)
def clear_cache():
    # Sentinel constraint: clear cache before each rate limit test
    cache.clear()
    yield
    cache.clear()

@pytest.mark.django_db
def test_login_rate_limit():
    client = APIClient()
    url = '/api/auth/login/'
    data = {'username': 'testuser', 'password': 'wrongpassword'}

    # First 5 requests should be processed (returning 400 or 401 due to bad credentials)
    for _ in range(5):
        response = client.post(url, data, REMOTE_ADDR='127.0.0.1')
        assert response.status_code in [400, 401]

    # 6th request should be throttled
    response = client.post(url, data, REMOTE_ADDR='127.0.0.1')
    assert response.status_code == 429
    assert 'throttled' in response.data.get('detail', '').lower()

@pytest.mark.django_db
def test_register_rate_limit():
    client = APIClient()
    url = '/api/auth/register/'
    data = {'username': 'newuser', 'password': 'Password123!', 'password2': 'Password123!'}

    # First 5 requests should be processed
    for _ in range(5):
        response = client.post(url, data, REMOTE_ADDR='127.0.0.1')
        # Even if they return 400 (e.g. duplicate username), the throttle should still count
        assert response.status_code in [201, 400]

    # 6th request should be throttled
    response = client.post(url, data, REMOTE_ADDR='127.0.0.1')
    assert response.status_code == 429
    assert 'throttled' in response.data.get('detail', '').lower()
