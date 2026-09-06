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
