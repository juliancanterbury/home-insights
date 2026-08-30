# Cockpit setup

Cockpit reads the same shared energy backend and weather feed as the existing pages. No extra setup is required for telemetry already used by Home Insights.

## Optional Home Assistant controls and infrastructure

1. Open `Code.gs` in the existing Apps Script project.
2. Find `configureCockpitEntities()`.
3. Uncomment and edit only the entities you want Cockpit to expose.
4. Run `configureCockpitEntities()` once, then redeploy the Apps Script web app.

Only explicitly listed controls are accepted. Supported controls are:

- `switch`, `light`, and `input_boolean` entities with `kind: 'toggle'`
- `climate` entities with `kind: 'mode'` and an explicit list of allowed modes

Optional `internet` and `network` sensor mappings are read-only. If they are absent, Cockpit shows “Not mapped” rather than inventing a value.

Every control action asks for confirmation in the browser. The backend validates both the entity allow-list and the permitted command before contacting Home Assistant.
