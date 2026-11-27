# App page structure

The app is split into standalone HTML pages under `pages/`, with shared styles in `assets/app.css` and shared behavior in `assets/app.js`. `index.html` opens `pages/daily-tasks.html`.

## Current pages

- `pages/daily-tasks.html`
- `pages/weekly-tasks.html`
- `pages/events-meetings.html`
- `pages/other-tasks.html`

Each page imports the common stylesheet and JavaScript and declares its route with `data-route` on `<body>`. The shared script handles page-specific rendering while persisting the same user state through Supabase.

## Adding a page

Create a dedicated HTML file in `pages/`, include the shared `../assets/app.css` and `../assets/app.js`, add its navigation link, and register its route and title in `assets/app.js`. Keep page-specific markup in that page file; shared authentication, Supabase state, and common controls remain in the shared assets. Deploy the root index, every page file, and both assets directories together.
