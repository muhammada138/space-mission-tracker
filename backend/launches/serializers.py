from rest_framework import serializers
from .models import Launch


class LaunchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Launch
        fields = [
            'id', 'api_id', 'name', 'rocket', 'launch_provider',
            'launch_date', 'status', 'mission_description', 'image_url',
            'last_fetched',
        ]
