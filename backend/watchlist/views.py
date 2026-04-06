from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.db.models import Count
from django.shortcuts import get_object_or_404

from launches.models import Launch
from launches.services import get_launch_by_api_id
from .models import WatchlistEntry, MissionLog, LaunchPrediction
from .serializers import WatchlistEntrySerializer, MissionLogSerializer, LaunchPredictionSerializer


# ── Watchlist ─────────────────────────────────────────────────────────────────

class WatchlistListView(generics.ListCreateAPIView):
    """GET/POST /api/watchlist/"""
    serializer_class = WatchlistEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = WatchlistEntry.objects.filter(user=self.request.user).select_related('launch')
        launch_api_id = self.request.query_params.get('launch_api_id')
        if launch_api_id:
            qs = qs.filter(launch__api_id=launch_api_id)
        return qs

    def perform_create(self, serializer):
        api_id = self.request.data.get('launch_api_id')
        if not api_id:
            raise ValidationError({'launch_api_id': 'This field is required.'})

        # Make sure the launch exists in our DB (fetch + cache if not)
        launch = get_launch_by_api_id(api_id)
        if launch is None:
            raise ValidationError({'launch_api_id': 'Launch not found in Launch Library API.'})

        # If already in watchlist, return existing entry gracefully instead of erroring
        existing = WatchlistEntry.objects.filter(user=self.request.user, launch=launch).first()
        if existing:
            raise ValidationError({'detail': 'already_in_watchlist', 'id': existing.id})

        serializer.save(user=self.request.user, launch=launch)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=False)
        try:
            self.perform_create(serializer)
        except ValidationError as exc:
            detail = exc.detail
            # Return existing entry ID so frontend can sync state
            if isinstance(detail, dict) and detail.get('detail') == 'already_in_watchlist':
                return Response({'id': detail['id'], 'already_saved': True}, status=status.HTTP_200_OK)
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class WatchlistDetailView(generics.DestroyAPIView):
    """DELETE /api/watchlist/<id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WatchlistEntry.objects.filter(user=self.request.user)


# ── Mission Logs ──────────────────────────────────────────────────────────────

class MissionLogListView(generics.ListCreateAPIView):
    """GET/POST /api/watchlist/logs/"""
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
    """GET/PUT/DELETE /api/watchlist/logs/<id>/"""
    serializer_class = MissionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MissionLog.objects.filter(user=self.request.user)


# ── Launch Predictions ────────────────────────────────────────────────────────

class LaunchPredictionView(APIView):
    """GET/POST /api/watchlist/predictions/<launch_api_id>/"""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, launch_api_id):
        """Return vote counts + current user's vote (if any)."""
        try:
            launch = Launch.objects.get(api_id=launch_api_id)
        except Launch.DoesNotExist:
            return Response({'on_time': 0, 'delayed': 0, 'scrubbed': 0, 'user_vote': None})

        counts = (
            LaunchPrediction.objects.filter(launch=launch)
            .values('prediction')
            .annotate(count=Count('id'))
        )
        tally = {'on_time': 0, 'delayed': 0, 'scrubbed': 0}
        for row in counts:
            tally[row['prediction']] = row['count']

        user_vote = None
        if request.user.is_authenticated:
            vote = LaunchPrediction.objects.filter(launch=launch, user=request.user).first()
            if vote:
                user_vote = vote.prediction

        return Response({**tally, 'user_vote': user_vote})

    def post(self, request, launch_api_id):
        """Cast or update the current user's vote."""
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        prediction = request.data.get('prediction')
        if prediction not in ('on_time', 'delayed', 'scrubbed'):
            return Response({'detail': 'Invalid prediction value.'}, status=status.HTTP_400_BAD_REQUEST)

        launch = get_launch_by_api_id(launch_api_id)
        if launch is None:
            return Response({'detail': 'Launch not found.'}, status=status.HTTP_404_NOT_FOUND)

        obj, created = LaunchPrediction.objects.update_or_create(
            user=request.user,
            launch=launch,
            defaults={'prediction': prediction},
        )
        return Response({'prediction': prediction, 'created': created}, status=status.HTTP_200_OK)
