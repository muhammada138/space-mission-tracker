from django.urls import path
from .views import (
    UpcomingLaunchesView, PastLaunchesView, ActiveLaunchesView,
    PayloadsInOrbitView, LaunchDetailView, LaunchUpdatesView, LaunchPadWeatherView,
    StarshipTestsView,
)

urlpatterns = [
    path('upcoming/', UpcomingLaunchesView.as_view(), name='launches-upcoming'),
    path('past/', PastLaunchesView.as_view(), name='launches-past'),
    path('active/', ActiveLaunchesView.as_view(), name='launches-active'),
    path('payloads/', PayloadsInOrbitView.as_view(), name='launches-payloads'),
    path('starship-tests/', StarshipTestsView.as_view(), name='starship-tests'),
    path('<str:api_id>/updates/', LaunchUpdatesView.as_view(), name='launch-updates'),
    path('<str:api_id>/pad-weather/', LaunchPadWeatherView.as_view(), name='launch-pad-weather'),
    path('astronauts/', views.AstronautListView.as_view(), name='astronaut-list'),
    path('stations/', views.SpaceStationListView.as_view(), name='station-list'),
    path('news/', views.ArticleListView.as_view(), name='article-list'),
    path('live-ops/', views.LiveOpsView.as_view(), name='live-ops'),
    path('<str:api_id>/', views.LaunchDetailView.as_view(), name='launch-detail'),

]
