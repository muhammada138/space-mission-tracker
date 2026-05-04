## 2026-05-04 - Replaced Python-level filtering with DB-level filtering
**Learning:** `Launch.objects.all()` combined with Python iterative filtering is inefficient as it fetches all objects into memory.
**Action:** Use DB-level QuerySet filtering (`filter()` and `exclude()`) directly.