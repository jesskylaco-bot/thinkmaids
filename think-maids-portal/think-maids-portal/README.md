# Think Maids — Crew Portal

A lightweight, mobile-first replacement for giving cleaners direct access to
Housecall Pro. Admins import the HCP schedule export; cleaners log in and see
only their own jobs, schedule, and estimated earnings.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **SQLite via `node:sqlite`** — Node's built-in SQLite module. No native
  build step (no `node-gyp`), which matters in sandboxed/offline build
  environments where compiling `better-sqlite3` isn't possible. It's marked
  "experimental" by Node but is stable for this use case; swapping to
  `better-sqlite3` later is a one-file change in `src/lib/db.ts` if you ever
  need to.
- **bcryptjs** for password hashing, **jose** for signed session cookies
  (JWT in an httpOnly cookie — no separate session store needed)
- **Papaparse** for CSV parsing

No external services, no `.env` secrets required to run locally (though you
should set `SESSION_SECRET` for anything beyond local testing — see below).

## Getting started

```bash
npm install
npm run seed      # creates the admin + cleaner accounts and imports the sample CSV
npm run dev        # http://localhost:3000
```

Seeded logins (**change these passwords before real use**):

| Role     | Email                       | Password       |
|----------|------------------------------|-----------------|
| Admin    | admin@thinkmaids.com         | ChangeMe123!    |
| Cleaner  | rose@thinkmaids.com          | ChangeMe123!    |
| Cleaner  | francesca@thinkmaids.com     | ChangeMe123!    |

For production, set a real `SESSION_SECRET` environment variable (any long
random string) — without it the app falls back to a dev default, which is
fine locally but not for a real deployment.

```bash
npm run build
npm run start
```

## CSV import

Admin → Import lets you upload a Housecall Pro schedule export (`.csv`).
Re-uploading the same export **updates** existing jobs by `Job #` instead of
creating duplicates — this is enforced at the database level via an `UPSERT`
keyed on `job_number`, not just app logic, so it holds even if the importer
is called from somewhere else later (e.g. a future API sync). Tested by
re-importing the same 450-row file twice: second pass produced 0 new rows,
450 updates.

The importer reads these columns from the actual export format:
`Job #`, `Job description`, `Job status`, `Customer name`, `Address`,
`Job created date`, `Job scheduled start date`, `Assigned employees`,
`Job amount`, `Due amount` — and will also pick up `Job scheduled end date`,
`Service type`, `Phone`, `Email`, `Notes`, `Special instructions`, `Tags`,
and `Recurring` if a future export includes them, without any code changes.

**What's *not* in the current export**, and how the app handles it: separate
start/end times (only a start timestamp exists — the UI shows "Not provided
in export" for end time), a structured service type (falls back to the
free-text job description), phone/email/notes/special instructions (left
blank, schema already has the columns ready). If/when Housecall Pro starts
including these, they'll populate automatically on the next import with no
migration needed.

**Employee name matching:** the export's `Assigned employees` text doesn't
always match an account name exactly (the real export has "Francesa Torres",
missing a "c"). The importer keeps an `employee_aliases` table mapping raw
export strings to real accounts, and any name it can't match shows up under
Admin → Import → *Unmatched employee names* with a dropdown to map it
manually. Once mapped, all of that name's past and future jobs attach to the
right cleaner automatically. In the sample data, Katie Welsh, Samantha
Ayling, Yolanda Padilla, and Vilma Argueta show up unmatched since they
aren't active cleaner accounts.

Rows missing a `Job #` or `Customer name` are skipped and reported in the
import summary rather than silently dropped or guessed at.

## Roles & security

- **Admin**: import schedules, view/edit all jobs, manage cleaner accounts
  and commission rates, view reports.
- **Cleaner**: sees only their own jobs. This is enforced in the database
  query itself (`WHERE assigned_user_id = <session user id>`), never by
  fetching everything and filtering in the browser — so there's no API
  response a cleaner could inspect to see another cleaner's data. Verified:
  one cleaner hitting another cleaner's job-detail URL gets a 404, not the
  job.

Route protection lives in `src/proxy.ts` (Next.js 16's replacement for
`middleware.ts` — same idea, new name) and runs on every request: unauthenticated
users are redirected to `/login`, and `/admin*` routes 403/redirect for
non-admins. Passwords are hashed with bcrypt; sessions are signed JWTs in an
httpOnly, sameSite cookie — never stored in localStorage or sent to the client.

## Commission & earnings

Commission percentage is configurable per cleaner (Admin → Commission or
Admin → Cleaners), stored in its own `commission_settings` table rather than
hardcoded. Formula throughout the app:

```
Estimated earnings = Job total × Commission percentage
```

Today/week/month/year totals on the cleaner dashboard are computed from the
cleaner's own jobs and their current rate — if you change someone's rate,
already-displayed historical earnings reflect the new rate (this is an
*estimate* tool, not a payroll ledger — a real payroll export would need rate
history, which isn't built yet).

## Database schema

`users`, `commission_settings`, `employee_aliases`, `jobs`, `import_history` —
all normalized, see `src/lib/db.ts` for the full DDL. Former cleaners (no
longer working) are represented as `employee_aliases` rows with no linked
user: their historical jobs still import and keep a name, but they have no
login and aren't assignable going forward.

## Folder structure

```
src/
  app/
    login/                                public login page
    dashboard/, schedule/, jobs/[id]/     cleaner-facing pages
    admin/                                admin pages (overview, import, jobs,
                                           cleaners, commission, reports)
    api/                                  route handlers (auth, admin/*, cleaner/*)
  components/                             shared UI (JobCard, StatusBadge, shells, etc.)
  lib/                                    db.ts, auth.ts, csv-importer.ts, commission.ts, types.ts
  proxy.ts                                route protection (auth + role checks)
scripts/seed.mjs                          creates accounts + imports the sample CSV
sample-data/                              the Housecall Pro export used for seeding
data/                                     SQLite database file lives here (gitignored)
```

## Future-proofing this was built for

- **Housecall Pro API instead of CSV**: the importer (`src/lib/csv-importer.ts`)
  is the only place that knows about CSV rows; it writes into the same `jobs`
  table an API sync would. Swapping the source means writing a new function
  with the same upsert shape — the rest of the app (dashboards, earnings,
  admin views) doesn't change.
- Schema already has columns for **before/after photos, GPS, signatures,
  recurring jobs** even though nothing writes to them yet — the cleaner job
  detail page has placeholder tiles for these.
- `import_history` keeps a record of every import (who, when, counts, errors)
  so a future "Google Calendar sync" or "HCP webhook" could log into the same
  table for a unified audit trail.

## What this app intentionally does not do yet

This was scoped as a schedule + earnings viewer, not a payroll system: it
doesn't track actual hours worked, doesn't handle tax withholding, and
"Mark Complete," photo uploads, and inspection checklists are UI placeholders
only (per the brief — wired up but inactive, ready for a follow-up build).
