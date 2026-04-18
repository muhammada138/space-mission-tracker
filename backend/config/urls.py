from django.contrib import admin
from django.urls import path, include
from launches.views import SpaceWeatherView, ISSCrewView
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView,
)
from users.views import CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', TokenBlacklistView.as_view(), name='token_blacklist'),

    # App routes
    path('api/auth/', include('users.urls')),
    path('api/launches/', include('launches.urls')),
    path('api/watchlist/', include('watchlist.urls')),

    # Space weather
    path('api/space-weather/', SpaceWeatherView.as_view(), name='space-weather'),

    # ISS crew proxy (open-notify is HTTP-only, blocked by browsers on HTTPS)
    path('api/iss-crew/', ISSCrewView.as_view(), name='iss-crew'),
]
