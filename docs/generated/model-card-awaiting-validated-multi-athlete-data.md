# SwimSight Model Card: awaiting-validated-multi-athlete-data

Generated: 2026-07-13T12:10:37.387Z

Artifact payload SHA-256: `55ca2cc9a8c080a44d9709903c9799db6ed54bd41234344419cb7314e391b181`

Artifact status: **UNTRAINED**

Registry release status: **NOT_ATTACHED_TO_RELEASE_SNAPSHOT**
Evaluation status: **PROVISIONAL_OR_UNTRAINED**

## Intended use

Conservative, decision-support estimates for competitive swimmers who have eligible official race history. Outputs are uncertainty-aware and must not be treated as guarantees, selection decisions, medical advice, or prescriptive coaching.

## Excluded use

- Athlete selection, scholarship, employment, or eligibility decisions.
- Medical, injury, recovery, or nutrition decisions.
- Ranking athletes across protected or legally sensitive traits.
- Predictions without minimum data-quality eligibility.
- Public reporting of cohorts below the configured privacy threshold.

## Data and provenance

Training inputs must be separately consented, pseudonymized, provenance-preserving official results. Subjective post-race feedback is excluded unless a future versioned inclusion policy is explicitly approved. This artifact contains no athlete identifiers or raw race rows.

## Evaluation

| Course | Status | Training rows | Athletes | Rolling-origin MAE |
| --- | --- | ---: | ---: | ---: |
| None | UNTRAINED | Not available | Not available | Not validated |

Only rows marked **VALIDATED** may support validated metric claims. The current card deliberately reports “not validated” when cohort evidence is insufficient.

## Calibration and uncertainty

Prediction intervals and probabilities use residuals from chronological out-of-time folds when those residuals exist. Otherwise the application labels probability output provisional and widens ranges based on data quality.

## Subgroup policy

Release gates require event, course, age band, category, and horizon evidence for both champion and challenger. A challenger is rejected when required subgroup evidence is missing or aggregate gains conceal a material regression. Small cohorts are marked insufficient rather than scored.

## Known failure modes

- Sparse, stale, converted, duplicated, or course-mismatched histories.
- Changes in training, illness, injury, taper, race conditions, or technique not represented at prediction time.
- Athletes outside the available training distribution.
- Retrospectively corrected source metadata without recorded-at provenance.

## Release decision

Training success never promotes a model. A candidate remains a challenger until it passes configured champion and baseline gates and an authorized operator records an explicit promotion decision.

## Reproducibility

Run `python3 scripts/train-100-free-xgboost.py <consented-csv...>` with dependencies in `scripts/requirements-model.txt`. Preserve the emitted artifact, evaluation JSON, source fingerprints, code revision, and consent eligibility snapshot.
