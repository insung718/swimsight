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
- Vercel Web Analytics for privacy-friendly pageview tracking

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

Without Clerk keys, the public product page remains available but account features stay locked. Add Clerk values to `.env.local` to enable sign-in:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL="/"
ADMIN_EMAILS="your-google-email@example.com"
```

Enable Google OAuth in the Clerk dashboard under **User & Authentication > Social connections**. Once enabled, the app's sign-in button creates a real user account and the backend upserts that user into PostgreSQL.

## Database

Set `DATABASE_URL` in `.env.local`, then run:

```bash
npm run db:generate
npm run db:migrate
```

For production deploys, run:

```bash
npm run db:deploy
```

The Prisma schema includes users, swim results, goals, predictions, teams, and memberships. New accounts start empty and all displayed performance data comes from that authenticated user.

The v1 schema also includes:

- `Community` and `CommunityMembership` for swim groups and join codes
- `Friendship` for friend requests and accepted connections
- `UpcomingMeet` for countdowns and target events
- `SwimSource` for distinguishing manual, CSV, and meet-import results
- Immutable model registry decisions, quality-scored prediction attempts, and drift snapshots
- Versioned consent events and isolated post-race feedback revisions

Vercel preview and local builds never run migrations. Production builds run `prisma migrate deploy` under a PostgreSQL advisory lock and fail before application compilation if migration deployment fails. See [Migration Safety](./docs/migration-safety.md) before changing production schema.

## API

All account API endpoints require Clerk auth and `DATABASE_URL`. They fail closed with `401` or `503` when auth/database configuration is missing.

### `GET /api/me`

Returns the current authenticated account.

### `GET /api/swims`

Returns the signed-in user's swims.

### `GET|PATCH|DELETE /api/me/privacy`

Reads or changes versioned consent. `DELETE` supports confirmed training-data exclusion or full account-data deletion. Model-training and public-research consent for users under 18 requires separate guardian consent.

### `GET /api/me/export`

Downloads a no-cache, machine-readable JSON export of the authenticated account.

### `GET|POST|PATCH|DELETE /api/race-feedback`

Manages account-scoped, versioned post-race context. Subjective feedback is stored separately from official result labels and is not training eligible.

### `GET|POST /api/admin/model-governance`

Trusted-admin-only model registry and monitoring endpoint. It can refresh evidence snapshots but cannot train or promote a model.

## Security

- Every `/api/*` request is rate limited by IP; authenticated requests also receive a user quota.
- Admin status is server-only and email-allowlisted with `ADMIN_EMAILS`; regular users can only choose swimmer or coach.
- Production should configure Upstash Redis for distributed limits:

```bash
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

- Local development falls back to an in-memory limiter.
- JSON writes enforce content type, body-size limits, same-origin checks, strict Zod schemas, allowlisted enums, normalized text, and unknown-field rejection.
- CSV imports are capped at 500 rows and reject unsupported or duplicate headers.
- Secrets belong only in `.env.local` and Vercel environment variables. Never prefix server secrets with `NEXT_PUBLIC_`.
- Configure independent 32-byte `TRAINING_PSEUDONYM_SECRET` and `MODEL_GOVERNANCE_AUDIT_SECRET` values for production.
- See [SECURITY.md](./SECURITY.md) for reporting and operational guidance.

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
npm run model:report
```

## Vercel Analytics

Web Analytics is enabled through `@vercel/analytics`. After deployment, visit the production site once and Vercel will begin showing visitors and page views in the project Analytics tab.

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

1. Acquire a credible, version-consented multi-athlete dataset.
2. Complete a provider-backup restore drill and record recovery time.
3. Run rolling-origin evaluation and register immutable champion/challenger evidence.
4. Keep unsupported cohorts provisional instead of adding another forecasting algorithm.
