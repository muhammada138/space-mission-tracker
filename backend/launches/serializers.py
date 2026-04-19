from rest_framework import serializers
from .models import Launch, Astronaut, SpaceStation, Spacecraft, Article


class AstronautSerializer(serializers.ModelSerializer):
    class Meta:
        model = Astronaut
        fields = '__all__'


class SpaceStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpaceStation
        fields = '__all__'


class SpacecraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spacecraft
        fields = '__all__'


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = '__all__'


class LaunchSerializer(serializers.ModelSerializer):
    crew = AstronautSerializer(many=True, read_only=True)
    articles = ArticleSerializer(many=True, read_only=True)

    class Meta:
        model = Launch
        fields = '__all__'


class BriefLaunchSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    crew = AstronautSerializer(many=True, read_only=True)

    class Meta:
        model = Launch
        fields = [
            'id', 'api_id', 'name', 'rocket', 'launch_provider',
            'launch_date', 'status', 'image_url',
            'pad_name', 'pad_location', 'pad_latitude', 'pad_longitude',
            'orbit', 'mission_type',
            'webcast_url', 'landing_pad', 'crew',
        ]
