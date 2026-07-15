# Pilot Operations Guide

## Objective

Run a small, consented, longitudinal pilot that creates future official outcomes. Do not manufacture accounts, races, retention, or readiness counts.

## Administrator setup

1. Configure one or more exact emails in server-only `ADMIN_EMAILS`.
2. Configure Clerk, PostgreSQL, Upstash Redis, `TRAINING_PSEUDONYM_SECRET`, `ROSTER_IMPORT_SECRET`, `AUDIT_PSEUDONYM_SECRET`, and `CRON_SECRET` in production.
3. Open `/internal/readiness` and create a named pilot cohort with a stable label and optional end date.
4. Confirm the page still reads `NOT READY FOR MODEL TRAINING` unless all real thresholds are met.

## Coach setup

1. Create a club from the coach workspace.
2. Select the club and active pilot cohort.
3. Upload a `Name,Email` roster matching [pilot-roster.csv](./examples/pilot-roster.csv).
4. Review invalid, duplicate, or formula-like rows and the requested scopes.
5. Commit once to create one-use links. The CSV does not create accounts and does not reveal whether an email is registered.
6. Deliver each link through an approved private channel. SwimSight does not send roster email.

## Athlete acceptance

The athlete signs in and opens the invitation. Before acceptance, SwimSight shows the cohort name, club name, expiry, and exact coach-access scopes. Explicit acceptance creates pilot enrollment, swimmer team membership, and a versioned active share grant for results, goals, predictions, upcoming meets, and private coach notes. The athlete can withdraw from the privacy panel; withdrawal also disables the linked share grant. Model-training and public-research consent remain separate choices.

## Least privilege

- Team owners and coaches can view only swimmers in that team with an active grant.
- Each resource requires its matching scope. Results access does not imply goals, predictions, or meets access.
- Coach notes require the explicit `COACH_NOTES` scope and stay separate from official results and model labels. Legacy `coach-share-v1` grants do not silently acquire this scope.
- Every allowed or denied athlete-data access is appended to a hash-linked audit chain.

## Pilot monitoring

The restricted readiness page reports invitation capacity/use, active/withdrawn/completed enrollments, and 7/30-day return rates. Rates remain suppressed below five eligible participants. Product analytics are allowlisted, consent-dependent, bucketed, and expire after 90 days.

## Support and exit

- Revoke unused links immediately when a roster changes.
- Ask athletes to correct source exports and re-preview rather than editing official provenance silently.
- Use import rollback for batch mistakes; affected cohort artifacts are invalidated.
- Honor export, consent withdrawal, training-data exclusion, pilot withdrawal, and account deletion from the athlete privacy panel.
- Escalate suspected account access or data exposure through `SECURITY.md`.
