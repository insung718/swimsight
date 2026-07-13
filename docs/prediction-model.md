# SwimSight 100 Freestyle Prediction Model

SwimSight uses a governed two-stage prediction system:

1. An explicitly promoted XGBoost champion for a course after a training artifact passes temporal evaluation, release gates, subgroup guardrails, and an audited promotion decision.
2. A conservative trend ensemble when no validated artifact is available.

The fallback is intentional. A successful training run never changes production by itself. SwimSight does not label a model as production XGBoost until it has enough consented multi-athlete data, beats the current champion and every required baseline under time-aware validation, passes subgroup guardrails, and receives an explicit promotion decision.

## Target

One training example predicts the official 100 m freestyle time at a target race. LCM, SCM, and SCY are trained as separate models. Raw times are never mixed across courses.

## Input data

The trainer accepts long-form CSV files with one official race per row:

```csv
athlete_id,race_date,course,time_seconds,age,sex,taper_days,swim_sessions_per_week
anonymous-athlete-001,2026-01-12,LCM,61.42,15,MALE,7,6
```

`athlete_id` should be an anonymized stable identifier. The exported model contains no athlete IDs or raw rows.

## Features

| Feature | Reason |
| --- | --- |
| Last 20 race times | Captures current level and progression while limiting stale history |
| Days between each race and target | Makes recent performances more meaningful than old ones |
| Best and mean over 3, 5, 10, and 20 races | Separates demonstrated potential from typical performance |
| Standard deviation over 5, 10, and 20 races | Represents consistency and uncertainty |
| Time slope over 5, 10, and 20 races | Captures improving, stable, or declining trends |
| Latest known age before the target race | Accounts for nonlinear age-group development without reading future target-row metadata |
| Performance category | Selects the relevant performance distribution |
| Latest known taper duration before the target race | Represents reported pre-race training reduction without reading future target-row metadata |
| Latest known swim sessions per week before the target race | Represents reported preparation consistency and training exposure |
| Forecast days | Allows one model to estimate different future dates |
| History count | Tells the model when it is working with sparse evidence |

## Leakage prevention

- Every feature row is generated from races strictly before the target race date.
- The target race is never present in its own lag, PB, average, or slope features.
- Only the most recent 20 prior races are used.
- Age, sex, taper, and training frequency are taken from the latest prior record available at the historical cutoff. The future target row contributes only its date and outcome label.
- Every generated example records its cutoff and feature timestamps; validation rejects a feature timestamp later than its cutoff.
- Athlete identifiers are used only for grouping, never as model features.
- Duplicate athlete/date/course/time rows are removed before feature generation.
- Course models are isolated, so LCM, SCM, and SCY times cannot leak into each other.
- Rolling folds train on earlier target dates and validate on later target dates.
- A separate GroupKFold evaluation holds out complete athletes.
- The final test metrics and data fingerprint are stored in the artifact; raw data is not.

## Evaluation

The primary metric is mean absolute error in seconds:

```text
MAE = mean(abs(actual_time - predicted_time))
```

The trainer and registry report:

- Rolling future-race MAE
- Median absolute error and RMSE
- Completely held-out athlete MAE
- Last-race baseline MAE
- Last-three-race average baseline MAE
- Five-race linear-trend baseline MAE
- Conservative deterministic baseline MAE
- Brier score and probability calibration error
- Prediction-interval coverage
- Results by horizon, event, age band, category, and course
- 80th percentile absolute residual for the likely range
- Signed residual quantiles for probability calibration

The trainer may mark a course artifact as evaluation-eligible only when it has at least 100 examples, at least 15 athletes, at least three valid rolling folds, and beats its trainer baselines by at least 2%. This is not a production promotion. The model registry separately compares the challenger with the current champion and all required baselines across aggregate and subgroup release gates. Invalid, tiny, missing, or materially regressing cohorts fail closed. Promotion is explicit, serializable, and audit-recorded; retraining and promotion are never automatic.

## Training

```bash
python3 -m venv .venv-model
source .venv-model/bin/activate
python3 -m pip install -r scripts/requirements-model.txt
npm run model:train -- data/100-free-training.csv
```

The command exports `src/lib/models/100-free-xgboost.json`. The Python trainer verifies that the exported tree representation produces the same predictions as native XGBoost before writing it. An `EXPERIMENTAL` artifact is retained for reproducibility when it fails a baseline, but the TypeScript runtime will not serve that course model.

Artifact schema version 2 includes cover statistics for every tree node. The TypeScript runtime uses those statistics to calculate exact, additive TreeSHAP contributions without loading Python or exposing training rows in production. A validated artifact must also include time-aware cross-validation residual quantiles. Missing or malformed explanation and calibration metadata causes the learned model to fail closed.

## Product behavior

The dashboard shows the point forecast, likely range, model source, data sufficiency, history used, validation MAE when available, and the inputs associated with the forecast. Validated XGBoost predictions show grouped TreeSHAP contributions. Conservative predictions show an additive decomposition of the deterministic formula. Both are described as model associations, not causes.

PB, goal, and optional qualifying-time probabilities use the empirical signed residual distribution when a validated artifact is active. Other models derive provisional probabilities from their uncertainty range and label them accordingly.

Every attempted future forecast receives a deterministic data-quality assessment. The quality decision controls whether SwimSight provides a full prediction, conservative estimate, provisional probability, or no prediction, and the exact assessment is preserved with the immutable evaluation snapshot. The conservative deterministic forecast is retained beside learned forecasts for later comparison.

See [Prediction evaluation](./prediction-evaluation.md) for matching rules and account isolation, [Evaluation methodology v3](./evaluation-methodology-v3.md) for temporal backtesting and release metrics, and the [Model governance policy](./model-governance-policy.md) for champion-challenger promotion and audit rules.
