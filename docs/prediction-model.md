# SwimSight 100 Freestyle Prediction Model

SwimSight uses a two-stage prediction system:

1. A validated XGBoost model for a course when a training artifact passes the quality gate.
2. A conservative trend ensemble when no validated artifact is available.

The fallback is intentional. SwimSight does not label a model as XGBoost until it has enough multi-athlete data and beats simple baselines under time-aware validation.

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
| Age at target race | Accounts for nonlinear age-group development |
| Performance category | Selects the relevant performance distribution |
| Taper duration | Represents planned pre-race reduction in training load |
| Swim sessions per week | Represents preparation consistency and training exposure |
| Forecast days | Allows one model to estimate different future dates |
| History count | Tells the model when it is working with sparse evidence |

## Leakage prevention

- Every feature row is generated from races strictly before the target race date.
- The target race is never present in its own lag, PB, average, or slope features.
- Only the most recent 20 prior races are used.
- Taper and training frequency must describe information known before the target race.
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

The trainer reports:

- Rolling future-race MAE
- Completely held-out athlete MAE
- Last-race baseline MAE
- Last-three-race average baseline MAE
- Five-race linear-trend baseline MAE
- 80th percentile absolute residual for the likely range

A course model becomes production-active only when it has at least 100 examples, at least 15 athletes, at least three valid rolling folds, and beats the best baseline by at least 2%. These thresholds can be made stricter as the dataset grows.

## Training

```bash
python3 -m venv .venv-model
source .venv-model/bin/activate
python3 -m pip install -r scripts/requirements-model.txt
npm run model:train -- data/100-free-training.csv
```

The command exports `src/lib/models/100-free-xgboost.json`. The Python trainer verifies that the exported tree representation produces the same predictions as native XGBoost before writing it.

## Product behavior

The dashboard shows the point forecast, likely range, model source, data sufficiency, history used, validation MAE when available, and the inputs associated with the forecast. Factors are described as associations, not causes.

Every future forecast is also preserved as an immutable evaluation snapshot. See [Prediction evaluation](./prediction-evaluation.md) for matching rules, account isolation, baseline comparisons, and known limitations.
