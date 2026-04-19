from django.core.management.base import BaseCommand
from launches.sync_service import sync_service

class Command(BaseCommand):
    help = 'Initial seeding of space data (Astronauts, Stations, News)'

    def add_arguments(self, parser):
        parser.add_argument('--astronauts', type=int, default=20, help='Number of astronauts to sync')
        parser.add_argument('--stations', action='store_true', help='Sync space stations')
        parser.add_argument('--news', action='store_true', help='Sync latest news')

    def handle(self, *args, **options):
        self.stdout.write('Starting initial data seed...')
        
        if options['astronauts']:
            self.stdout.write(f"Syncing {options['astronauts']} astronauts...")
            sync_service.sync_astronauts(limit=options['astronauts'])
            
        if options['stations']:
            self.stdout.write("Syncing space stations...")
            sync_service.sync_stations()
            
        if options['news']:
            self.stdout.write("Syncing latest news...")
            sync_service.sync_recent_news()
            
        self.stdout.write(self.style.SUCCESS('Successfully seeded space data.'))
