# SwimSight

SwimSight is a modern swim analytics MVP for competitive swimmers, coaches, and school or club teams. It tracks race history, personal bests, improvement rates, consistency, trends, future time predictions, goals, team leaderboards, and a proprietary Swim Power Index.

## Tech Stack

- Next.js 15 App Router
- React, TypeScript, TailwindCSS, Recharts
- Next.js API Routes
- PostgreSQL with Prisma ORM
- Clerk authentication
- Vitest unit tests and Playwright e2e tests
- Vercel-ready deployment

## MVP Features

- Performance overview with total swims, PB count, strongest event, and most improved event
- Personal best tracker with current PB, date achieved, previous PB, and improvement
- Interactive progression chart with event filter, year filter, hover values, and zoom brush
- Analytics engine for improvement rate, rankings, consistency, trends, predictions, goal pace, and SPI
- Regression predictions for 30, 90, 180, and 365 days
- Goal tracker with required weekly/monthly improvement, current pace, and likelihood
- Google-ready Clerk authentication and per-user account sync
- Manual time entry plus CSV upload/import
- Upcoming meet countdowns with target events
- Communities, join codes, friend requests, and comparison-ready community analytics
- Motivational tips generated from training data and upcoming meets
- Coach/team dashboard with leaderboard, most improved swimmer, fastest swimmer, and team progress
- CSV upload and validation for `Date,Event,Time`
- Light/dark mode and responsive layouts

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs in demo mode without Clerk keys. Add Clerk values to `.env.local` to enable sign-in controls:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL="/"
```

Enable Google OAuth in the Clerk dashboard under **User & Authentication > Social connections**. Once enabled, the app's sign-in button creates a real user account and the backend upserts that user into PostgreSQL.

## Database

Set `DATABASE_URL` in `.env.local`, then run:

```bash
npm run db:generate
npm run db:migrate
```

The Prisma schema includes users, swim results, goals, predictions, teams, and memberships. The current UI uses seed data so the MVP is immediately demoable.

The v1 schema also includes:

- `Community` and `CommunityMembership` for swim groups and join codes
- `Friendship` for friend requests and accepted connections
- `UpcomingMeet` for countdowns and target events
- `SwimSource` for distinguishing manual, CSV, and meet-import results

## API

All write endpoints require Clerk auth and `DATABASE_URL`. Read endpoints fall back to demo data when auth/database config is missing.

### `GET /api/me`

Returns the current account, or demo account metadata.

### `GET /api/swims`

Returns the signed-in user's swims, or demo swim results.

### `POST /api/swims`

Creates a manual swim result.

```json
{
  "date": "2026-03-16",
  "event": "100 Butterfly",
  "course": "LCM",
  "timeSeconds": 63.8,
  "meetName": "BIS HCMC Time Trial"
}
```

### `GET /api/analytics`

Returns dashboard analytics: overview, PBs, rankings, predictions, goal projection, and Swim Power Index.

### `POST /api/import`

Validates CSV text. Pass `"persist": true` to save valid rows to the signed-in account.

Request:

```json
{
  "csv": "Date,Event,Time\n2026-03-16,50 Free,25.56"
}
```

Response:

```json
{
  "validRows": [
    {
      "date": "2026-03-16",
      "event": "50 Freestyle",
      "timeSeconds": 25.56,
      "course": "LCM",
      "meetName": "Imported meet"
    }
  ],
  "errors": []
}
```

### `POST /api/goals`

Creates a goal for the signed-in user.

### `GET /api/meets`

Returns upcoming meets with `daysUntil`.

### `POST /api/meets`

Creates an upcoming meet.

```json
{
  "name": "City Championships",
  "location": "Ho Chi Minh City",
  "startDate": "2027-03-01",
  "targetEvents": ["50 Freestyle", "100 Butterfly"]
}
```

### `GET /api/motivation`

Returns short motivational tips based on swims and the next meet.

### `GET /api/communities`

Lists communities for the signed-in user.

### `POST /api/communities`

Creates a community and owner membership.

```json
{
  "name": "BIS HCMC Swim Team",
  "description": "School swim team comparison group"
}
```

### `POST /api/communities/join`

Joins a community by join code.

### `GET /api/communities/:communityId/compare`

Returns comparison-ready member analytics for a community.

### `GET /api/friends`

Lists friend requests and accepted connections.

### `POST /api/friends`

Creates a friend request by email.

### `PATCH /api/friends`

Accepts or blocks an incoming friend request.

## Tests

```bash
npm run test
npm run test:e2e
```

## Project Structure

```text
app/                  Next.js routes and API handlers
prisma/               PostgreSQL schema
src/components/       Reusable dashboard components
src/lib/              Analytics, CSV validation, events, sample data, utilities
src/types/            Shared TypeScript models
tests/unit/           Vitest coverage for analytics and CSV import
tests/e2e/            Playwright smoke tests
```

## Next Steps

1. Add real Clerk and production Postgres env vars in Vercel.
2. Run Prisma migrations against the production database.
3. Connect the Google Stitch frontend to the v1 API contracts.
4. Add AI training recommendations and time-standard comparisons after v1 is stable.
