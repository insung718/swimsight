# Prediction Evaluation

SwimSight preserves forecasts before race day and measures them against later official results. This creates an auditable record of what the model predicted at the time, rather than recalculating history with newer data or a newer model.

## Snapshot contract

Each snapshot stores:

- Athlete account, event, course, target date, target type, and forecast horizon
- Point forecast, lower and upper bounds, confidence, and generation timestamp
- Model source, version, validation MAE, training date, and training-row count
- Immutable feature snapshot, feature groups, eligibility rules, top factors, data sufficiency, and distribution warnings
- Explanation method, additive base value, and local contribution snapshot
- PB, goal, and optional qualifying-time probabilities plus their calibration method
- Last-race, last-three-average, and linear-trend baseline forecasts
- Goal time known when the snapshot was created

Feature snapshots, local explanation payloads, and residual quantiles remain server-side. The performance API returns only the metrics and history fields needed by the signed-in athlete dashboard.

PostgreSQL enforces snapshot input immutability. Only the documented outcome fields may be attached or cleared by the strict evaluation/rollback lifecycle; forecast values, model metadata, eligibility, and prediction-time features cannot be rewritten after creation.

## Matching rules

A result evaluates a snapshot only when all of the following match:

1. The result belongs to the same authenticated athlete account.
2. The result is an official individual swim, not training, a relay split, a converted time, or a time trial.
3. Event and course are identical. SwimSight never compares LCM, SCM, and SCY without an explicit conversion model.
4. The official result date is the snapshot target date.
5. The prediction existed before the result was recorded.

The match stores an evaluation-policy version and match provenance. Public validation additionally requires a source-backed imported result with an import-row reference and original-row hash. Self-declared official results may evaluate private forecasts but do not support public performance claims.

When an athlete has multiple eligible results for the same event, course, and day, SwimSight evaluates the race-day best. Multiple snapshots and model versions for that target are retained and evaluated independently.

## Metrics

For each evaluated snapshot, SwimSight calculates absolute error, signed error, percentage error, interval inclusion, PB achievement, goal achievement, and qualifying-standard achievement. The account-scoped dashboard aggregates:

- Mean absolute error (MAE)
- Median absolute error
- Root mean squared error (RMSE)
- Forecast interval coverage
- Error by event, age group, confidence, data sufficiency, and model version
- MAE against last-race, last-three-average, and linear-trend baselines
- Brier scores and reliability bins for PB, goal, and qualifying probabilities

Pending forecasts are shown separately and never included in accuracy metrics.

After an exact match, the athlete may optionally record taper duration, effort, illness, injury, course verification, unusual circumstances, and whether the prediction was useful. This context is versioned and kept separate from the official result, forecast snapshot, and research label; it is not silently used as a training target.

## Data quality and isolation

- Result dates cannot be in the future.
- New manual and spreadsheet results receive an account-aware deterministic deduplication key.
- Spreadsheet imports reject duplicate rows before persistence.
- Relay, converted, time-trial, training, cross-course, and cross-account data are excluded from evaluation.
- Database constraints reject invalid forecast bounds, confidence values, model sources, and sufficiency labels.
- A malformed or incomplete XGBoost artifact fails closed to the conservative model.
- Goal feasibility is course-specific. LCM, SCM, and SCY histories are never mixed.
- Import rollback clears any derived evaluation fields before deleting the source result and invalidates sealed cohort manifests that referenced it.

## Known limitations

- Exact-date matching is deliberately strict. A race on a different day remains unmatched even when it is close to the target date.
- Forecast evaluation currently measures official individual race-day bests; it does not distinguish prelims from finals.
- Historical results created before deterministic deduplication may have a null dedupe key.
- Accuracy becomes meaningful only after enough real forecasts reach race day. Low sample counts should not be treated as proof of model quality.
- The first validated learned model remains 100 Freestyle. Other events use the transparent conservative ensemble until independently validated models beat the baselines.
- Probabilities from the conservative ensemble are provisional range-derived estimates. Only forecasts backed by held-out signed residual quantiles are labeled validated.
- TreeSHAP explains why the model produced a number; it does not prove that changing a feature will cause the corresponding time change.
