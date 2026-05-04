## 2026-05-04 - Confirmations & A11y Labels
**Learning:** Destructive actions without confirmation dialogs and missing ARIA labels on icon-only buttons create poor accessibility and risk accidental user actions, particularly in lists and overlays.
**Action:** Always add `window.confirm` to delete operations and ensure all icon-only buttons (`<button><Trash2 /></button>`) have proper `aria-label` and `title` attributes.
