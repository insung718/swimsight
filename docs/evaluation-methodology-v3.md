# Prediction Intelligence v3 Evaluation Methodology

## Inclusion criteria

Only official, individual, same-event, same-course results are eligible labels. Relay splits, converted times, training swims, invalid dates, implausible times, duplicate identities, and records without required provenance are excluded or explicitly flagged. A user must have active, versioned model-training consent. Users under 18 also require active guardian consent. Missing age is excluded from training because minor status cannot be resolved safely.

## Temporal design

The trainer builds rolling-origin folds. At each cutoff, all training targets precede the validation period. Within each example, the latest feature timestamp must precede the target race. The future row contributes only the outcome and target date; age, category, taper, training frequency, race lags, and aggregates come from records available before the target.

This differs from athlete-group cross-validation. Group CV measures transfer to unseen athletes but can still mix calendar periods. Rolling-origin backtesting better approximates a live deployment and is the primary release signal. Both are reported because discrepancies can reveal athlete memorization, season drift, or temporal instability.

## Metrics and baselines

Reports include sample size, MAE, median absolute error, RMSE, Brier score, calibration error, interval coverage, and signed residual quantiles. Results are broken down by course, forecast horizon, age band, performance category, and model version when minimum samples are met. The candidate is compared with the champion, last race, last-three average, linear trend, and conservative deterministic forecast.

## Leakage controls and unresolved limits

- Athlete history never crosses athlete identifiers.
- All lag features are created from rows strictly before the label date.
- Training extraction uses keyed pseudonyms and excludes revoked consent.
- Subjective post-race feedback is physically separate and not training eligible.
- Source corrections cannot be time-travel-safe unless the provider supplies a `recorded_at` or revision timestamp. Datasets lacking that provenance must disclose this limitation.

## Reproducibility

1. Freeze a consent-eligibility snapshot and source files.
2. Record source SHA-256 fingerprints and the Git commit.
3. Install `scripts/requirements-model.txt` in an isolated Python environment.
4. Run `python3 scripts/train-100-free-xgboost.py <inputs...>`.
5. Run `npm run model:report` against the emitted artifact.
6. Preserve the model artifact, evaluation JSON, model card, logs, and release decision together.

An `UNTRAINED`, `EXPERIMENTAL`, or insufficient-sample result is not a failed experiment; it is an explicit absence of validated evidence.
