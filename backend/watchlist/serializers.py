from rest_framework import serializers
from launches.serializers import LaunchSerializer
from .models import WatchlistEntry, MissionLog


class WatchlistEntrySerializer(serializers.ModelSerializer):
    launch = LaunchSerializer(read_only=True)
    launch_api_id = serializers.CharField(write_only=True)

    class Meta:
        model = WatchlistEntry
        fields = ['id', 'launch', 'launch_api_id', 'added_at']
        read_only_fields = ['id', 'added_at']


class MissionLogSerializer(serializers.ModelSerializer):
    launch = LaunchSerializer(read_only=True)
    launch_api_id = serializers.CharField(write_only=True)

    class Meta:
        model = MissionLog
        fields = ['id', 'launch', 'launch_api_id', 'title', 'body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
