# Space Mission Tracker

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Django](https://img.shields.io/badge/Django-092E20?style=flat&logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/Django_REST-ff1709?style=flat&logo=django&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=flat&logo=JSON%20web%20tokens)

Full-stack web app for tracking rocket launches from multiple sources. Browse upcoming and past missions, save launches to a personal watchlist, and write mission logs. Pulls live data from the Launch Library 2 API and the SpaceX API.

---

## What it does

Most space tracking sites dump a wall of launches with no way to personalize anything. This app lets you filter by data source (Launch Library 2 vs SpaceX), save missions you care about, and keep personal notes on launches you followed.

Key features:
- **Multi-source launch data** - pulls from both Launch Library 2 (all global launches) and the SpaceX API, with a toggle to filter between them
- **Rich launch detail pages** - mission description, launch pad location, orbit, provider, live countdown timer for upcoming launches
- **Watchlist** - save any launch to your personal list, quick-remove from dashboard
- **Mission logs** - write and edit personal notes/logs for any launch you've followed
- **JWT authentication** - secure register/login with automatic token refresh
- **Aggressive caching** - all API data is cached in the local database to avoid rate limits (2hr TTL for LL2, 30min for SpaceX)
- **Live countdowns** - real-time countdown timers on upcoming launch cards

## Getting started

You need Python 3.10+ and Node.js 18+.

### Backend
```
cd backend
python -m venv .venv
.venv\Scripts\activate  # or source .venv/bin/activate on mac/linux
pip install -r requirements.txt
cp .env.example .env  # add your keys
python manage.py migrate
python manage.py runserver
```

### Frontend
```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and the frontend proxies API calls to Django on port 8000.

## Environment variables

```
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=          # leave blank for SQLite, fill in for PostgreSQL
NASA_API_KEY=          # optional, for future use
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register/` | Create account |
| `POST` | `/api/auth/login/` | Get JWT tokens |
| `POST` | `/api/auth/refresh/` | Refresh access token |
| `GET` | `/api/auth/me/` | Current user info |
| `GET` | `/api/launches/upcoming/?source=all` | Upcoming launches (source: all, ll2, spacex) |
| `GET` | `/api/launches/past/?source=all` | Past launches |
| `GET` | `/api/launches/<api_id>/` | Single launch detail |
| `GET` | `/api/watchlist/` | User's saved launches |
| `POST` | `/api/watchlist/` | Add launch to watchlist |
| `DELETE` | `/api/watchlist/<id>/` | Remove from watchlist |
| `GET` | `/api/watchlist/logs/` | User's mission logs |
| `POST` | `/api/watchlist/logs/` | Create a mission log |
| `PUT` | `/api/watchlist/logs/<id>/` | Update a log |
| `DELETE` | `/api/watchlist/logs/<id>/` | Delete a log |

## How the caching works

Both external APIs have rate limits (LL2 especially - 15 requests/hour for unauthenticated users). To handle this:

1. Every API response gets upserted into the local database with a `last_fetched` timestamp
2. On subsequent requests, if cached data is fresh enough (2 hours for LL2, 30 minutes for SpaceX), we serve from the database and skip the external call
3. If the external API fails (rate limited, timeout, etc.), we fall back to whatever stale data we have cached
4. SpaceX launches are prefixed with `spacex_` in their `api_id` so they never collide with LL2 data

## Data sources

- [Launch Library 2](https://thespacedevs.com/llapi) (v2.2.0) - covers all global launch providers
- [SpaceX API](https://github.com/r-spacex/SpaceX-API) (v5) - SpaceX-specific launch, rocket, and launchpad data
