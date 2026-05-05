## 2024-05-24 - Interactive Card Accessibility
**Learning:** Custom interactive elements (like cards acting as buttons via `role="button"` and `tabIndex={0}`) require an `aria-label` to provide context to screen readers, as the visual structure alone is insufficient.
**Action:** Always verify that elements with `role="button"` have a clear and descriptive `aria-label`, especially when navigating to detail pages.
