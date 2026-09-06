# Home Insights update — 8 August 2026

## Visual correction

- Removed the heavy service-card borders introduced in the first package.
- Restored restrained dark Sankey nodes while keeping Solar/Grid/Battery flow colours consistent.
- Moved the House status clear of the roof and horizontal power path.
- Restored the two verified 2026 Gas bill readings when a newly-created cloud meter sheet is empty, then syncs them to the shared sheet.
- Uses the latest measured Gas daily average beyond the final bill date, rather than dropping Gas from today’s service total.
- Recovered all 22 actual Water bill totals from the earlier Home Insights archive (March 2021–June 2026) and restored billing-period daily averages and historical range changes.

- Unified Electricity (amber), Gas (orange), and Water (cyan) colors across service cards, meter cards, legends, charts, and Sankey flows.
- Added cloud-first gas/water meter reading synchronization through the existing Apps Script endpoint, with local cache retained for offline fallback.
- Included the complete updated `Code.gs` with cloud meter-reading, deletion, and historical-range routes integrated into the existing backend.
- Balanced the House live card with a live `Idle`/`Active` label above the icon.
- Loads all cloud gas/water readings and merges them with cached readings, so water ranges can use every available bill/manual record.
- Restored Ask Home Insights for exact dates, “this time last year,” and complete calendar months such as June 2025.
- Fixed the FREE badge so it is truly hidden outside 11:00–14:00; the configured free-window calculation remains timestamp-based.
- Recolored and clarified Sankey sources/destinations with coherent directional flows.
- Added consistent Powershop-style vertical spot cursors and wheel/drag-friendly horizontal navigation across chart types.
# 2026-08-30 — Cockpit

- 2026-09-06 v10: embedded the complete August 2018–June 2026 Gas billing archive, converted each billing total into its correct daily MJ profile, merged it with newer manual readings, and made 1Y/All render directly at the available width without a scrollbar.
- 2026-09-06 v9: made Water a permanent primary-navigation destination, added an explicit Water-history/Add-reading action to the Services card, and replaced Sankey strokes with filled translucent glass ribbons and Sigenergy-style stacked source/destination panels.
- 2026-09-06: restored a dedicated Water page with its own bill/use graph, Add reading access and historic readings; made Electricity and Gas 1Y/All charts fit the available width; and rebuilt the Sankey with proportional stacked nodes, percentages and translucent Sigenergy-style bands in the established resource colours.
- 2026-09-05: repaired services/electricity/water chart scaling, restored archived gas history for long ranges, restored meter-photo drag and drop, and rebuilt the Sankey as aligned translucent Sigenergy-style lanes.
- Fixed the Overview solar status label colliding with the house roof at compact widths.
- Moved the House live-state label inside the house graphic so it cannot collide with Solar's status.
- Made Cockpit full-screen sizing resilient to cached navigation scripts, preloaded its live graph from recorded samples, and strengthened the spacecraft presentation.
- Added auto-discovered read-only Rinnai, SpeedTest and lunar telemetry plus weather, water and cost visualisations.
- Added a separate dense, dark Cockpit dashboard without changing the existing page layouts.
- Added live power routing, SOC, resource and cost summaries, weather, tariff state, infrastructure status and compact trends.
- Added optional, explicitly allow-listed Home Assistant toggle and climate-mode controls.
- Added responsive desktop, iPad and phone layouts and a Cockpit navigation item.
