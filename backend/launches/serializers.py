from rest_framework import serializers
from .models import Launch


class LaunchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Launch
        fields = [
            'id', 'api_id', 'name', 'rocket', 'launch_provider',
            'launch_date', 'status', 'mission_description', 'image_url',
            'pad_name', 'pad_location', 'orbit', 'mission_type',
            'webcast_url', 'wiki_url', 'infographic_url', 'landing_pad',
            'pad_latitude', 'pad_longitude',
            'last_fetched',
        ]
