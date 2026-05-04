## 2026-05-04 - Fix Hardcoded API Key Fallback
**Vulnerability:** Hardcoded API key fallback ('DEMO_KEY') used for NASA DONKI API calls when the environment variable was missing.
**Learning:** Hardcoding default API keys risks unauthorized use or throttling issues if exposed, and forces dependency on unmanaged credentials.
**Prevention:** Keys must be managed exclusively via environment variables. Missing keys should gracefully skip dependent API calls and log a warning instead of using fallbacks.