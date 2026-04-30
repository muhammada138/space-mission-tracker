## 2024-04-16 - React.memo in List Items with Timers
**Learning:** In a dashboard tracking space launches with countdowns, having timers tick every second can trigger re-renders that cascade down to all siblings if state management or props aren't handled carefully. A single unmemoized list item (`LaunchCard`) causes the entire list to churn unnecessarily when parent components update.
**Action:** Always wrap `LaunchCard` and `CountdownTimer` in `React.memo` when rendering lists of hundreds of launches. This ensures that only components whose specific props change (or that manage their own internal ticking state) will re-render, greatly improving performance for users scrolling through the mission control views.
## 2024-10-27 - Pre-compiled Regex for Keyword Matching
**Learning:** In keyword-heavy matching loops (like RSS or social media parsing in StarshipTestsView), replacing `any(k in text for k in keywords)` with pre-compiled regex objects (`re.search`) defined as class attributes provides a measurable performance boost and reduces CPU overhead.
**Action:** Always look for opportunities to replace nested loops that iterate over large keyword lists with pre-compiled regex objects for faster text matching.

## 2025-02-24 - Database Filtering vs Python Filtering
**Learning:** In Django APIs fetching potentially thousands of records (like the 'In Flight' fallback query in `ActiveLaunchesView`), using `Launch.objects.all()` and iterating in an O(N) Python loop to filter dates/statuses massively spikes memory and CPU usage. The database is heavily penalized for instantiating unused ORM objects.
**Action:** Always push filtering down to the database using `Launch.objects.filter()` and `.exclude()` before evaluating querysets. This drastically reduces the data transferred and objects instantiated, especially when dealing with fast-growing datasets like historical space launches.
