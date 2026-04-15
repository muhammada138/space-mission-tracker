from django.urls import path
from .views import (
    UpcomingLaunchesView, PastLaunchesView, ActiveLaunchesView,
    PayloadsInOrbitView, LaunchDetailView, LaunchUpdatesView, LaunchPadWeatherView,
)

urlpatterns = [
    path('upcoming/', UpcomingLaunchesView.as_view(), name='launches-upcoming'),
    path('past/', PastLaunchesView.as_view(), name='launches-past'),
    path('active/', ActiveLaunchesView.as_view(), name='launches-active'),
    path('payloads/', PayloadsInOrbitView.as_view(), name='launches-payloads'),
    path('<str:api_id>/updates/', LaunchUpdatesView.as_view(), name='launch-updates'),
    path('<str:api_id>/pad-weather/', LaunchPadWeatherView.as_view(), name='launch-pad-weather'),
    path('<str:api_id>/', LaunchDetailView.as_view(), name='launch-detail'),
]
