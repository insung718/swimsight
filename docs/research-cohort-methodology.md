# Research Cohort Methodology

## Eligibility

A training candidate must be an athlete with the current model-training consent, no withdrawal or exclusion, and verified guardian consent when under 18. Only official individual results persisted by the extraction cutoff with an import-row link, original-row hash, external meet ID, and external result ID are considered research-grade. Private manual or weak-provenance imports remain available to the athlete but are excluded. Unknown-age minors are excluded.

## Prediction-time availability

Each target result uses at most the previous 20 same-event, same-course races with source dates strictly before the target date. Same-day and future-dated races are excluded regardless of database order. Historical age, category, taper, and training frequency are not reconstructed; unavailable values remain absent rather than receiving present-day profile values. For retrospective authorized imports, source race date is the logical availability boundary and importer provenance discloses later database ingestion; database creation time is not misrepresented as the historical race publication time.

## Split policy

Athletes, not rows, are assigned to train/validation/test by a stable HMAC pseudonym hash using a 70/15/15 policy. Every row for one athlete remains in one split. The training secret must be stable and server-only.

## Manifest contract

Every sealed manifest records:

- immutable inclusion and exclusion rules;
- consent and feature-schema versions;
- extraction cutoff and generation timestamp;
- split policy and assignments;
- importer versions and source-method summary;
- event, course, split, age-band, and category distributions;
- exclusion reason counts;
- source-record hashes and prediction-time feature snapshots;
- dataset and manifest hashes;
- athlete and record counts.

Subgroups below five athletes are suppressed even in the internal distribution summary. The public validation page uses a higher minimum of 25 athletes plus 30 evaluated predictions.

## Correction and withdrawal

Sealed manifests are never updated in place. Import rollback, source-result deletion, account deletion, or applicable consent withdrawal marks affected manifests `INVALIDATED` and removes corresponding cohort records where policy requires. Regeneration creates a new version and hashes.

## Readiness thresholds

Current strategic targets are 300 statistically usable consented athletes, 2,000 eligible official races, 300 prospectively evaluated predictions, and at least five major event groups meeting minimum coverage. These are operational targets, not proof of statistical power for every subgroup. Evaluation precision, baseline samples, calibration samples, subgroup balance, and temporal holdouts must still be reviewed before any promotion.
