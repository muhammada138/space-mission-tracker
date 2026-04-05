from django.db import models


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

    last_fetched = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['launch_date']

    def __str__(self):
        return self.name
