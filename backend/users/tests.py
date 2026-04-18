from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from django.core.cache import cache

class RegisterViewTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('register')
        self.valid_payload = {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 'StrongTestP4ssw0rd!',
            'password2': 'StrongTestP4ssw0rd!'
        }
        # Clear cache to reset throttle counters
        cache.clear()

    def test_user_registration_success(self):
        """
        Ensure we can create a new user object.
        """
        response = self.client.post(self.register_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().username, 'testuser')
        self.assertIn('message', response.data)
        self.assertEqual(response.data['message'], 'Account created successfully.')
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'testuser')

    def test_user_registration_password_mismatch(self):
        """
        Ensure registration fails if passwords do not match.
        """
        payload = self.valid_payload.copy()
        payload['password2'] = 'differentpassword123'
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)
        self.assertIn('password', response.data)

    def test_user_registration_short_password(self):
        """
        Ensure registration fails if password is too short.
        """
        payload = self.valid_payload.copy()
        payload['password'] = 'short'
        payload['password2'] = 'short'
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)
        self.assertIn('password', response.data)

    def test_user_registration_weak_password(self):
        """
        Ensure registration fails if password is too common or weak.
        """
        payload = self.valid_payload.copy()
        payload['password'] = 'password123'
        payload['password2'] = 'password123'
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)
        self.assertIn('password', response.data)

    def test_user_registration_duplicate_username(self):
        """
        Ensure registration fails if username already exists.
        """
        # Create user first
        User.objects.create_user(
            username=self.valid_payload['username'],
            email=self.valid_payload['email'],
            password=self.valid_payload['password']
        )

        response = self.client.post(self.register_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 1)  # Only the original user should exist
        self.assertIn('username', response.data)
