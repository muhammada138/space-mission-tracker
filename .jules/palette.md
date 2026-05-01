## YYYY-MM-DD - [Proper Form Associations in Custom Select Panels]
**Learning:** In custom filter panels (like those in Home and Rockets pages), custom `select` wrappers often miss explicit `htmlFor` attributes linking them to their labels, reducing screen reader accessibility.
**Action:** Always ensure that `label` elements include `htmlFor` and their corresponding form controls (`select`, `input`) have matching `id`s, especially in dynamically rendered advanced filter panels.
