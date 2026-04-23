from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.middleware.csrf import get_token

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            if access_token:
                response.set_cookie(
                    'access_token', access_token, httponly=True, secure=not settings.DEBUG, samesite='Lax'
                )
            if refresh_token:
                response.set_cookie(
                    'refresh_token', refresh_token, httponly=True, secure=not settings.DEBUG, samesite='Lax'
                )
            get_token(request)
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def get_serializer(self, *args, **kwargs):
        if 'data' in kwargs:
            data = kwargs['data'].copy()
            if 'refresh' not in data and 'refresh_token' in self.request.COOKIES:
                data['refresh'] = self.request.COOKIES['refresh_token']
            kwargs['data'] = data
        return super().get_serializer(*args, **kwargs)

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            if access_token:
                response.set_cookie(
                    'access_token', access_token, httponly=True, secure=not settings.DEBUG, samesite='Lax'
                )
            refresh_token = response.data.get('refresh')
            if refresh_token:
                response.set_cookie(
                    'refresh_token', refresh_token, httponly=True, secure=not settings.DEBUG, samesite='Lax'
                )
        return response

class CookieTokenLogoutView(APIView):
    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response
