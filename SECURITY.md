# SwimSight Security

## Supported Version

Security fixes are applied to the current `main` branch.

## Reporting

Do not open a public issue containing credentials, personal swim data, or exploit details. Contact the repository owner privately and include the affected route, reproduction steps, and impact.

## Production Checklist

- Store `DATABASE_URL`, `CLERK_SECRET_KEY`, and `UPSTASH_REDIS_REST_TOKEN` in Vercel environment variables only.
- Keep only the Clerk publishable key under a `NEXT_PUBLIC_` name.
- Set `ADMIN_EMAILS` to the repository owner's Google email only; never expose it as `NEXT_PUBLIC_ADMIN_EMAILS`.
- Enable Google OAuth and verified-email requirements in Clerk.
- Configure Upstash Redis so rate limits are shared across Vercel instances.
- Run `npm run db:deploy` before serving a schema-changing release.
- Rotate any key that has been pasted into chat, committed, logged, or otherwise shared outside its secret manager.
- Review Clerk, database, Vercel, and Upstash access periodically and remove unused credentials.

## Implemented Controls

- Clerk-authenticated, account-scoped API access
- Server-only admin allowlist that ignores untrusted database `ADMIN` roles
- IP and user rate limiting with graceful `429` responses
- Strict schema validation, normalization, field and payload limits
- Same-origin enforcement on state-changing requests
- Prisma parameterized database access and ownership checks
- Atomic CSV imports and bounded database reads
- Security headers and no-store API responses
- No sample user data in production runtime code
