# Statistics Pages Design

## Design system

Match the existing Schedule & Task Tracker UI. The Statistics and Daily Task Statistics screens use the same Roboto/system sans-serif typography and Material 3 inspired components as the task pages.

- Canvas: existing warm cream `--bg` with the shared subtle grid.
- Surfaces: existing `--surface` and `--surface-elevated` tokens.
- Text: `--text-primary` and `--text-secondary`.
- Accent: `--primary` amber, with existing semantic green, yellow, and red tokens for completion states.
- Shape and elevation: existing 18px card radius, 12px control radius, warm borders, and shared shadows.
- Respect the existing dark theme through shared variables. Do not introduce page-specific fonts or global styles that alter other routes.

## Statistics dashboard

- Use the familiar page-header card with a compact progress eyebrow and a short subtitle.
- Present daily completion, weekly completion, meeting attendance, and the nearest deadline in four responsive cards.
- Emphasize percentages using values calculated from live app state. Keep window selectors wired to existing saved settings.
- Link the daily card to the daily statistics detail page.
- Do not show sample metrics, unsupported charts, or placeholder summary cards.

## Daily Task Statistics

- Reuse the shared page-header, button, card, and typography styles.
- Provide a month navigation calendar, Monday-first weekday labels, visible selected day, and semantic completion states.
- Show the selected date's tasks and an expandable completion/change history table.
- Stack the calendar and selected-day panel on narrower screens; allow the history table to scroll horizontally.

## Stitch and app integration

Stitch project: `Schedule & Task Tracker — Statistics` (private, project `9293785972697357286`). Both screen designs use a design system based on the site's existing theme. The local implementation preserves the existing `renderStatisticsDashboard()` and daily-history/calendar functions, DOM IDs, Supabase-backed state, and saved statistics window selectors. Stitch's generated sample values are illustrative and must never replace live account data.
