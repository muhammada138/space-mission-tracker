import httpx
import logging
from django.utils import timezone
from datetime import timedelta
from .models import Launch, Astronaut, SpaceStation, Spacecraft, DockingEvent, Expedition, Article

logger = logging.getLogger(__name__)

LL2_BASE = 'https://ll.thespacedevs.com/2.2.0'
SNAPI_BASE = 'https://api.spaceflightnewsapi.net/v4'

class SyncService:
    """Centralized service for syncing space data with rate-limit protection."""
    
    def __init__(self):
        self.client = httpx.Client(timeout=20)
        self.calls_this_hour = 0
        self.max_calls_per_hour = 15  # Free tier limit

    def _get(self, url, params=None):
        if self.calls_this_hour >= self.max_calls_per_hour:
            logger.warning("LL2 Rate limit reached for this hour.")
            return None
        
        try:
            resp = self.client.get(url, params=params)
            self.calls_this_hour += 1
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"API Error: {e}")
            return None

    def sync_upcoming_launches(self):
        """Sync upcoming launches from LL2."""
        data = self._get(f"{LL2_BASE}/launch/upcoming/", params={'limit': 10, 'mode': 'detailed'})
        if not data:
            return
        
        from .services import _upsert_launches
        results = data.get('results', [])
        _upsert_launches(results)

    def sync_astronauts(self, limit=10):
        """Sync astronauts from LL2."""
        data = self._get(f"{LL2_BASE}/astronaut/", params={'limit': limit, 'mode': 'detailed'})
        if not data:
            return
        
        for item in data.get('results', []):
            Astronaut.objects.update_or_create(
                api_id=str(item['id']),
                defaults={
                    'name': item.get('name', ''),
                    'status': item.get('status', {}).get('name', ''),
                    'type': item.get('type', {}).get('name', ''),
                    'agency': item.get('agency', {}).get('name', ''),
                    'nationality': item.get('nationality', ''),
                    'bio': item.get('bio', ''),
                    'profile_image': item.get('profile_image', ''),
                    'wiki_url': item.get('wiki', ''),
                }
            )

    def sync_stations(self):
        """Sync space stations from LL2."""
        data = self._get(f"{LL2_BASE}/spacestation/", params={'limit': 10, 'mode': 'detailed'})
        if not data:
            return
        
        for item in data.get('results', []):
            SpaceStation.objects.update_or_create(
                api_id=str(item['id']),
                defaults={
                    'name': item.get('name', ''),
                    'status': item.get('status', {}).get('name', ''),
                    'type': item.get('type', {}).get('name', ''),
                    'orbit': item.get('orbit', ''),
                    'description': item.get('description', ''),
                    'image_url': item.get('image_url', ''),
                    'owners': [o.get('name') for o in item.get('owners', [])],
                }
            )

    def sync_recent_news(self):
        """Sync news articles from SNAPI."""
        try:
            resp = self.client.get(f"{SNAPI_BASE}/articles/", params={'limit': 10})
            resp.raise_for_status()
            data = resp.json()
            
            for item in data.get('results', []):
                article, created = Article.objects.update_or_create(
                    api_id=str(item['id']),
                    defaults={
                        'title': item.get('title', ''),
                        'url': item.get('url', ''),
                        'image_url': item.get('image_url', ''),
                        'news_site': item.get('news_site', ''),
                        'summary': item.get('summary', ''),
                        'published_at': item.get('published_at'),
                    }
                )
                
                # Link to launches if mentioned
                launch_ids = [str(l['launch_id']) for l in item.get('launches', [])]
                if launch_ids:
                    launches = Launch.objects.filter(api_id__in=launch_ids)
                    article.launches.add(*launches)
        except Exception as e:
            logger.error(f"SNAPI Sync Error: {e}")

# Global instance
sync_service = SyncService()
