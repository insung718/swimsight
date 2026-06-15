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
```

## Database

Set `DATABASE_URL` in `.env.local`, then run:

```bash
npm run db:generate
npm run db:migrate
```

The Prisma schema includes users, swim results, goals, predictions, teams, and memberships. The current UI uses seed data so the MVP is immediately demoable.

## API

### `GET /api/swims`

Returns demo swim results.

```json
{
  "swims": [
    {
      "id": "swim-004",
      "userId": "demo-athlete",
      "date": "2026-03-16",
      "event": "50 Freestyle",
      "course": "LCM",
      "timeSeconds": 25.56,
      "meetName": "BIS HCMC Time Trial"
    }
  ]
}
```

### `GET /api/analytics`

Returns dashboard analytics: overview, PBs, rankings, predictions, goal projection, and Swim Power Index.

### `POST /api/import`

Validates CSV text.

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

1. Replace demo data with Prisma-backed queries scoped by Clerk user ID.
2. Add coach-created teams and invitations.
3. Persist CSV imports into PostgreSQL.
4. Add AI training recommendations and time-standard comparisons after the MVP is stable.
