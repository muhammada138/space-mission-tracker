from django.contrib import admin
from django.urls import path, include
from launches.views import SpaceWeatherView, ISSCrewView
from users.auth_views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CookieTokenLogoutView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/auth/login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', CookieTokenLogoutView.as_view(), name='token_blacklist'),

    # App routes
    path('api/auth/', include('users.urls')),
    path('api/launches/', include('launches.urls')),
    path('api/watchlist/', include('watchlist.urls')),

    # Space weather
    path('api/space-weather/', SpaceWeatherView.as_view(), name='space-weather'),

    # ISS crew proxy (open-notify is HTTP-only, blocked by browsers on HTTPS)
    path('api/iss-crew/', ISSCrewView.as_view(), name='iss-crew'),
]
