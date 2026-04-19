from django.db import models


class Astronaut(models.Model):
    """Crew member data from Launch Library 2."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=256)
    status = models.CharField(max_length=128, blank=True, default='')
    type = models.CharField(max_length=128, blank=True, default='')
    agency = models.CharField(max_length=256, blank=True, default='')
    nationality = models.CharField(max_length=256, blank=True, default='')
    bio = models.TextField(blank=True, default='')
    profile_image = models.URLField(blank=True, default='', max_length=1024)
    wiki_url = models.URLField(blank=True, default='', max_length=1024)
    last_fetched = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class SpaceStation(models.Model):
    """Orbital station data (e.g. ISS, Tiangong)."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=256)
    status = models.CharField(max_length=128, blank=True, default='')
    type = models.CharField(max_length=128, blank=True, default='')
    orbit = models.CharField(max_length=128, blank=True, default='')
    description = models.TextField(blank=True, default='')
    image_url = models.URLField(blank=True, default='', max_length=1024)
    owners = models.JSONField(default=list, blank=True)
    last_fetched = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Spacecraft(models.Model):
    """Specific flight vehicle (e.g. Dragon 'Endeavour')."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=256)
    serial_number = models.CharField(max_length=128, blank=True, default='')
    status = models.CharField(max_length=128, blank=True, default='')
    description = models.TextField(blank=True, default='')
    image_url = models.URLField(blank=True, default='', max_length=1024)
    last_fetched = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class DockingEvent(models.Model):
    """A spacecraft docking at a station."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    docking_date = models.DateTimeField()
    undocking_date = models.DateTimeField(null=True, blank=True)
    space_station = models.ForeignKey(SpaceStation, on_delete=models.CASCADE, related_name='docking_events')
    spacecraft = models.ForeignKey(Spacecraft, on_delete=models.CASCADE, related_name='docking_events')
    docking_location = models.CharField(max_length=256, blank=True, default='')

    def __str__(self):
        return f"{self.spacecraft.name} @ {self.space_station.name}"


class Expedition(models.Model):
    """Long-duration crew stay on a station."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=256)
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)
    space_station = models.ForeignKey(SpaceStation, on_delete=models.CASCADE, related_name='expeditions')
    crew = models.ManyToManyField(Astronaut, related_name='expeditions')

    def __str__(self):
        return self.name


class Launch(models.Model):
    """Cached launch data from Launch Library 2 / SpaceX API."""

    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=512)
    rocket = models.CharField(max_length=256, blank=True, default='')
    launch_provider = models.CharField(max_length=256, blank=True, default='')
    launch_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=64, blank=True, default='')
    mission_description = models.TextField(blank=True, default='')
    image_url = models.URLField(blank=True, default='', max_length=1024)

    # Extended fields for richer detail
    pad_name = models.CharField(max_length=256, blank=True, default='')
    pad_location = models.CharField(max_length=256, blank=True, default='')
    orbit = models.CharField(max_length=128, blank=True, default='')
    mission_type = models.CharField(max_length=128, blank=True, default='')
    webcast_url = models.URLField(blank=True, default='', max_length=1024)
    wiki_url = models.URLField(blank=True, default='', max_length=1024)
    infographic_url = models.URLField(blank=True, default='', max_length=1024)
    landing_pad = models.CharField(max_length=256, blank=True, default='')

    # Relationships
    crew = models.ManyToManyField(Astronaut, related_name='launches', blank=True)

    # Launch pad coordinates (for weather lookups)
    pad_latitude = models.FloatField(null=True, blank=True)
    pad_longitude = models.FloatField(null=True, blank=True)

    last_fetched = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['launch_date']

    def __str__(self):
        return self.name


class Article(models.Model):
    """News articles from SNAPI linked to launches/stations."""
    api_id = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=512)
    url = models.URLField(max_length=1024)
    image_url = models.URLField(blank=True, default='', max_length=1024)
    news_site = models.CharField(max_length=256)
    summary = models.TextField(blank=True, default='')
    published_at = models.DateTimeField()
    launches = models.ManyToManyField(Launch, related_name='articles', blank=True)
    space_stations = models.ManyToManyField(SpaceStation, related_name='articles', blank=True)

    def __str__(self):
        return self.title
