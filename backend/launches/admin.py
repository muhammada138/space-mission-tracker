from django.contrib import admin
from .models import Launch


@admin.register(Launch)
class LaunchAdmin(admin.ModelAdmin):
    list_display = ['name', 'rocket', 'launch_provider', 'launch_date', 'status', 'last_fetched']
    search_fields = ['name', 'rocket', 'launch_provider', 'api_id']
    list_filter = ['status']
    ordering = ['launch_date']
