
## 2026-04-30 - Add ARIA Labels and htmlFor in Auth Forms
**Learning:** Critical accessibility gaps found in authentication forms where `<label>` elements lacked `htmlFor` associations with `<input>` fields, and icon-only buttons lacked `aria-label` attributes, significantly degrading the screen reader experience.
**Action:** Added proper associations and ARIA labels. Always ensure form elements have explicit IDs and labels use `htmlFor`, and icon-only interactive elements contain screen-reader friendly `aria-label`s.
