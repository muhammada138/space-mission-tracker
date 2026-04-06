from django.urls import path
from .views import UpcomingLaunchesView, PastLaunchesView, ActiveLaunchesView, LaunchDetailView, LaunchUpdatesView, LaunchPadWeatherView

urlpatterns = [
    path('upcoming/', UpcomingLaunchesView.as_view(), name='launches-upcoming'),
    path('past/', PastLaunchesView.as_view(), name='launches-past'),
    path('active/', ActiveLaunchesView.as_view(), name='launches-active'),
    path('<str:api_id>/updates/', LaunchUpdatesView.as_view(), name='launch-updates'),
    path('<str:api_id>/pad-weather/', LaunchPadWeatherView.as_view(), name='launch-pad-weather'),
    path('<str:api_id>/', LaunchDetailView.as_view(), name='launch-detail'),
]
