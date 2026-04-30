from django.core.management.base import BaseCommand
from launches.models import Launch
from launches.spacex_service import get_spacex_launch_by_id


class Command(BaseCommand):
    help = "Refreshes SpaceX landing pad data for existing launches"

    def handle(self, *args, **options):
        launches = Launch.objects.filter(api_id__startswith="spacex_")
        self.stdout.write(f"Refreshing {launches.count()} SpaceX launches...")

        for launch in launches:
            try:
                # get_spacex_launch_by_id handles the update_or_create logic
                get_spacex_launch_by_id(launch.api_id)
                self.stdout.write(
                    self.style.SUCCESS(f"Successfully refreshed {launch.name}")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Failed to refresh {launch.name}: {e}")
                )
