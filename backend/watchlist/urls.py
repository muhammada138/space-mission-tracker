from django.urls import path
from .views import (
    WatchlistListView, WatchlistDetailView,
    MissionLogListView, MissionLogDetailView,
    LaunchPredictionView,
)

urlpatterns = [
    path('', WatchlistListView.as_view(), name='watchlist-list'),
    path('<int:pk>/', WatchlistDetailView.as_view(), name='watchlist-detail'),
    path('logs/', MissionLogListView.as_view(), name='log-list'),
    path('logs/<int:pk>/', MissionLogDetailView.as_view(), name='log-detail'),
    path('predictions/<str:launch_api_id>/', LaunchPredictionView.as_view(), name='launch-prediction'),
]
