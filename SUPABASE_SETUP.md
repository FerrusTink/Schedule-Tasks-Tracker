# Enable login and cloud sync

The app uses Supabase Auth for email/password accounts and stores each account's tracker, statistics settings, and daily/weekly history in one JSON state row. The Supabase client session is persisted in the browser, so users stay signed in on that browser until they sign out or the session expires.

## 1. Create a Supabase project

The app is configured to use the supplied Supabase project URL and publishable key in `index.html`. The public publishable key is intended for browser use; never put a service-role key in this file.

## 2. Create the private per-user data table

Open the Supabase SQL Editor and run:

```sql
create table if not exists public.user_tracker_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_tracker_data enable row level security;

create policy "Users can read their own tracker"
  on public.user_tracker_data for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tracker"
  on public.user_tracker_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tracker"
  on public.user_tracker_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_tracker_data to authenticated;
```

## 3. Configure email authentication

In **Authentication → Providers**, enable Email. Choose whether new accounts require email confirmation. If confirmation is enabled, add the deployed site URL to **Authentication → URL Configuration** and the confirmation redirect allowlist. Users will need to confirm their email before their first sign-in.

## 4. Host the app

Serve `index.html` over HTTPS (or localhost during development). Open the site and create an account. Existing custom local tracker data on the first browser that signs into a new account is copied into that account; old built-in sample tasks and sample tags are removed. Later devices load the account's cloud data. A different account on the same browser gets its own data.

The app saves locally immediately and sends changes to Supabase shortly afterward. A failed sync is indicated in the **Sign out** button's hover text; retry by making a change after connectivity returns.

Daily and weekly history is captured from the time this statistics feature is enabled. The app cannot reconstruct completion or change-log data for older dates that were not previously recorded.


The site now has multiple HTML pages. Deploy the root `index.html`, the complete `pages/` directory, and the complete `assets/` directory together so all page links and shared Supabase integration remain available. See `APP_STRUCTURE.md` before adding a future page.
