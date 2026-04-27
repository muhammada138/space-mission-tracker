## 2024-04-16 - React.memo in List Items with Timers
**Learning:** In a dashboard tracking space launches with countdowns, having timers tick every second can trigger re-renders that cascade down to all siblings if state management or props aren't handled carefully. A single unmemoized list item (`LaunchCard`) causes the entire list to churn unnecessarily when parent components update.
**Action:** Always wrap `LaunchCard` and `CountdownTimer` in `React.memo` when rendering lists of hundreds of launches. This ensures that only components whose specific props change (or that manage their own internal ticking state) will re-render, greatly improving performance for users scrolling through the mission control views.

## 2024-04-18 - Replacing inner loops with pre-compiled Regex
**Learning:** In keyword-heavy matching loops (e.g., RSS or social media parsing in StarshipTestsView), replacing `any(k in text for k in keywords)` with pre-compiled regex objects (`re.search`) defined as class attributes provides a measurable performance boost (approx. 3.5x faster) and reduces CPU overhead.
**Action:** Always pre-compile regexes for keyword matching when iterating over large texts or lists, rather than using `any()` with list comprehensions and `in`.
