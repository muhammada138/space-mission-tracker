## 2026-05-03 - N+1 and full table scan in active launches view
**Learning:** Found a full table scan where `Launch.objects.all()` was used to fetch all historical launches into memory just to filter for launches in the last 3 hours in Python. Always use `.filter()` to let the database handle data restriction efficiently.
**Action:** Replaced `Launch.objects.all()` with `.filter(launch_date__gte=..., launch_date__lte=...).exclude(status__icontains="fail")`.
