from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import Launch
from .serializers import LaunchSerializer
from .services import get_upcoming_launches, get_past_launches, get_launch_by_api_id


class UpcomingLaunchesView(APIView):
    """GET /api/launches/upcoming/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        launches = get_upcoming_launches(limit=20)
        serializer = LaunchSerializer(launches, many=True)
        return Response(serializer.data)


class PastLaunchesView(APIView):
    """GET /api/launches/past/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        launches = get_past_launches(limit=20)
        serializer = LaunchSerializer(launches, many=True)
        return Response(serializer.data)


class LaunchDetailView(APIView):
    """GET /api/launches/<api_id>/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        launch = get_launch_by_api_id(api_id)
        if launch is None:
            return Response({'detail': 'Launch not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = LaunchSerializer(launch)
        return Response(serializer.data)
