## 2026-05-01 - [CRITICAL] Remove Hardcoded NASA_API_KEY Fallback
**Vulnerability:** A hardcoded fallback secret (`DEMO_KEY`) was used for `NASA_API_KEY` in `backend/launches/views.py`.
**Learning:** Hardcoded keys, even fallback or demo ones, can be abused if extracted. They bypass proper secret management via environment variables.
**Prevention:** Always enforce external API key presence through environment variables and handle missing keys gracefully by degrading functionality (e.g., skipping the API call and logging a warning) instead of using fallback string literals.
