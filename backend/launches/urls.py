from django.urls import path
from .views import UpcomingLaunchesView, PastLaunchesView, LaunchDetailView

urlpatterns = [
    path('upcoming/', UpcomingLaunchesView.as_view(), name='launches-upcoming'),
    path('past/', PastLaunchesView.as_view(), name='launches-past'),
    path('<str:api_id>/', LaunchDetailView.as_view(), name='launch-detail'),
]
