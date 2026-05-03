## 2026-05-03 - Hardcoded NASA API Key Fallback Removed
**Vulnerability:** Found a hardcoded "DEMO_KEY" fallback in `SpaceWeatherView` when fetching NASA DONKI API data (`os.environ.get("NASA_API_KEY", "DEMO_KEY")`).
**Learning:** The fallback "DEMO_KEY" is an exposed secret and should not be used as it bypassed the need for proper environment variable management.
**Prevention:** API keys must be managed strictly via environment variables. If a key is missing, skip the dependent API call and handle it gracefully.