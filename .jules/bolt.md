## 2024-04-16 - React.memo in List Items with Timers
**Learning:** In a dashboard tracking space launches with countdowns, having timers tick every second can trigger re-renders that cascade down to all siblings if state management or props aren't handled carefully. A single unmemoized list item (`LaunchCard`) causes the entire list to churn unnecessarily when parent components update.
**Action:** Always wrap `LaunchCard` and `CountdownTimer` in `React.memo` when rendering lists of hundreds of launches. This ensures that only components whose specific props change (or that manage their own internal ticking state) will re-render, greatly improving performance for users scrolling through the mission control views.

## 2024-04-18 - Missing imports in cached endpoints
**Learning:** When adding time-based caching logic (e.g., TTLs) to Python files using objects like `timedelta`, it is easy to assume they are already imported. A missing import will result in a `NameError` and completely crash the endpoint when the cache is set.
**Action:** Always explicitly verify that required modules like `timedelta` are imported (e.g., `from datetime import timedelta`) when adding caching logic to avoid runtime NameErrors.
