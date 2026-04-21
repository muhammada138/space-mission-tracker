## 2024-04-16 - React.memo in List Items with Timers
**Learning:** In a dashboard tracking space launches with countdowns, having timers tick every second can trigger re-renders that cascade down to all siblings if state management or props aren't handled carefully. A single unmemoized list item (`LaunchCard`) causes the entire list to churn unnecessarily when parent components update.
**Action:** Always wrap `LaunchCard` and `CountdownTimer` in `React.memo` when rendering lists of hundreds of launches. This ensures that only components whose specific props change (or that manage their own internal ticking state) will re-render, greatly improving performance for users scrolling through the mission control views.

## 2024-04-21 - Pre-compiling Regex in Text Heavy Loops
**Learning:** In the backend `StarshipTestsView`, parsing through thousands of text items (RSS feed entries, YouTube scraper items, Twitter tweets) inside loops using Python list comprehensions like `any(k in text for k in keywords)` creates excessive CPU overhead and blocks the thread.
**Action:** When performing substring or keyword checks against multiple terms in a tight loop, pre-compile the keywords into a single regex object (`re.compile('|'.join(re.escape(k) for k in keywords))`) and use `regex.search()` to drastically improve matching speed.
