import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import UserProfile

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_client():
    user = User.objects.create_user(username='testuser', password='password123')
    client = APIClient()
    client.force_authenticate(user=user)
    # Store user object in client for easy access in tests
    client.user = user
    return client

@pytest.mark.django_db
class TestMeView:
    url = '/api/auth/me/'

    def test_me_unauthenticated(self, api_client):
        response = api_client.get(self.url)
        assert response.status_code == 401

    def test_me_authenticated(self, auth_client):
        response = auth_client.get(self.url)
        assert response.status_code == 200
        assert response.data['username'] == auth_client.user.username
        assert response.data['email'] == auth_client.user.email


@pytest.mark.django_db
class TestProfileView:
    url = '/api/auth/profile/'

    def test_profile_unauthenticated(self, api_client):
        response = api_client.get(self.url)
        assert response.status_code == 401

        response = api_client.put(self.url, {'bio': 'New bio'})
        assert response.status_code == 401

    def test_profile_authenticated_get_auto_create(self, auth_client):
        # Ensure profile does not exist initially
        assert not UserProfile.objects.filter(user=auth_client.user).exists()

        response = auth_client.get(self.url)
        assert response.status_code == 200
        assert 'bio' in response.data
        assert response.data['bio'] == ''

        # Verify profile was auto-created
        assert UserProfile.objects.filter(user=auth_client.user).exists()

    def test_profile_authenticated_get_existing(self, auth_client):
        # Pre-create profile
        UserProfile.objects.create(user=auth_client.user, bio='Existing bio')

        response = auth_client.get(self.url)
        assert response.status_code == 200
        assert response.data['bio'] == 'Existing bio'

        # Verify only one profile exists
        assert UserProfile.objects.filter(user=auth_client.user).count() == 1

    def test_profile_authenticated_put(self, auth_client):
        response = auth_client.put(self.url, {'bio': 'Updated bio'})
        assert response.status_code == 200
        assert response.data['bio'] == 'Updated bio'

        # Verify database was updated
        profile = UserProfile.objects.get(user=auth_client.user)
        assert profile.bio == 'Updated bio'

    def test_profile_authenticated_patch(self, auth_client):
        response = auth_client.patch(self.url, {'bio': 'Patched bio'})
        assert response.status_code == 200
        assert response.data['bio'] == 'Patched bio'

        # Verify database was updated
        profile = UserProfile.objects.get(user=auth_client.user)
        assert profile.bio == 'Patched bio'
