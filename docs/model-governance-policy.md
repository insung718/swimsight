# SwimSight Model Governance Policy

## Scope

This policy applies to every statistical or learned model that produces a swimmer-facing forecast, probability, interval, or model-derived insight. The current 100 freestyle artifact is `UNTRAINED`; no validation claim is made until a consented dataset passes temporal and subgroup gates.

## Roles and release states

- **Challenger:** registered, immutable candidate. Training success does not authorize use.
- **Champion:** the single approved production model for one event and course.
- **Rejected:** failed one or more release gates.
- **Retired:** former champion retained for audit and reproducibility.

Every artifact records a SHA-256 hash plus model, dataset, feature schema, training code, and evaluation versions. `ModelReleaseDecision` is append-only in application services and protected from update or deletion by the database. Promotions require an explicit operator action; monitoring never retrains or promotes automatically. The serving runtime also requires the loaded artifact's version and SHA-256 hash to match the database champion for that event and course. A merely `VALIDATED` artifact cannot activate itself.

## Required release evidence

A challenger is compared with the champion and these deterministic baselines:

1. Last official race.
2. Last-three-race mean.
3. Linear recent trend.
4. Conservative deterministic forecast.

Default gates require at least 100 evaluated predictions and inspect MAE, median absolute error, RMSE, Brier score, calibration error, and interval coverage. Event, age band, performance category, course, and horizon segments with at least 20 observations are mandatory guardrails. Both champion and challenger must provide matching, unique, statistically eligible cohort keys for every dimension; omitted evidence fails closed. Aggregate gains cannot conceal more than a 5% subgroup error regression or a three-point interval-coverage regression. Thresholds are configuration, not evidence; a technical reviewer must approve changes.

## Overrides

An override must be exceptional, explicit, attributable through a keyed pseudonym, and accompanied by a reason and immutable metric snapshot. An override does not turn insufficient evidence into validated evidence. The current service does not expose promotion or override through a public API.

## Monitoring

Monitoring compares fixed baseline and recent windows for feature, prediction, residual, coverage, Brier-score, and unsupported-attempt-rate drift. Cohorts below 30 observations return `INSUFFICIENT_DATA` for that signal. Warnings produce evidence and a review recommendation only. They do not trigger training or promotion.

## Prohibited use

Models must not be used for medical guidance, athlete selection, scholarship or employment decisions, protected-trait ranking, or guaranteed performance claims. Finish-time data alone cannot justify specific training prescriptions.
