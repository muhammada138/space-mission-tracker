## 2024-05-02 - Missing ARIA Labels on Mobile Drawer Close Buttons
**Learning:** Icon-only close buttons (like an 'X' icon) within mobile navigation drawers frequently lack `aria-label` attributes, rendering them inaccessible to screen readers which will just announce "button" without context.
**Action:** Always ensure any icon-only button, especially those used for dismissing overlays or modals, has an explicit `aria-label="Close"` or similar descriptive attribute to maintain accessibility.
