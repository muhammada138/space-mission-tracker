from rest_framework import serializers
from .models import Launch


class LaunchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Launch
        fields = '__all__'


class BriefLaunchSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    class Meta:
        model = Launch
        fields = [
            'id', 'api_id', 'name', 'rocket', 'launch_provider',
            'launch_date', 'status', 'image_url',
            'pad_name', 'pad_location', 'orbit', 'mission_type',
            'webcast_url', 'landing_pad',
        ]
