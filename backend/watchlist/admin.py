from django.contrib import admin
from .models import WatchlistEntry, MissionLog


@admin.register(WatchlistEntry)
class WatchlistEntryAdmin(admin.ModelAdmin):
    list_display = ['user', 'launch', 'added_at']
    list_filter = ['added_at']


@admin.register(MissionLog)
class MissionLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'launch', 'title', 'created_at', 'updated_at']
    search_fields = ['title', 'body']
