from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from launches.models import Launch
from launches.services import get_launch_by_api_id
from .models import WatchlistEntry, MissionLog
from .serializers import WatchlistEntrySerializer, MissionLogSerializer


# ── Watchlist ─────────────────────────────────────────────────────────────────

class WatchlistListView(generics.ListCreateAPIView):
    """GET/POST /api/watchlist/"""
    serializer_class = WatchlistEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WatchlistEntry.objects.filter(user=self.request.user).select_related('launch')

    def perform_create(self, serializer):
        api_id = self.request.data.get('launch_api_id')
        if not api_id:
            raise ValidationError({'launch_api_id': 'This field is required.'})

        # Make sure the launch exists in our DB (fetch + cache if not)
        launch = get_launch_by_api_id(api_id)
        if launch is None:
            raise ValidationError({'launch_api_id': 'Launch not found in Launch Library API.'})

        if WatchlistEntry.objects.filter(user=self.request.user, launch=launch).exists():
            raise ValidationError({'detail': 'This launch is already in your watchlist.'})

        serializer.save(user=self.request.user, launch=launch)


class WatchlistDetailView(generics.DestroyAPIView):
    """DELETE /api/watchlist/<id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WatchlistEntry.objects.filter(user=self.request.user)


# ── Mission Logs ──────────────────────────────────────────────────────────────

class MissionLogListView(generics.ListCreateAPIView):
    """GET/POST /api/logs/"""
    serializer_class = MissionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MissionLog.objects.filter(user=self.request.user).select_related('launch')

    def perform_create(self, serializer):
        api_id = self.request.data.get('launch_api_id')
        if not api_id:
            raise ValidationError({'launch_api_id': 'This field is required.'})

        launch = get_launch_by_api_id(api_id)
        if launch is None:
            raise ValidationError({'launch_api_id': 'Launch not found in Launch Library API.'})

        serializer.save(user=self.request.user, launch=launch)


class MissionLogDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/logs/<id>/"""
    serializer_class = MissionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MissionLog.objects.filter(user=self.request.user)
