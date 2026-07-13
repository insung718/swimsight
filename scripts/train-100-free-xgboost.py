#!/usr/bin/env python3
"""Train and validate SwimSight's 100 freestyle XGBoost model.

Input CSV columns:
athlete_id,race_date,course,time_seconds,age,sex,taper_days,swim_sessions_per_week

Every example uses races strictly before its target race. The exported artifact
contains trees and aggregate metrics, never athlete IDs or raw records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import pandas as pd
    from sklearn.metrics import mean_absolute_error
    from sklearn.model_selection import GroupKFold
    from xgboost import XGBRegressor
except ImportError as error:
    raise SystemExit(
        "Install model dependencies: python3 -m pip install -r scripts/requirements-model.txt"
    ) from error


COURSES = ("LCM", "SCM", "SCY")
HISTORY_SIZE = 20
LAG_FEATURES = [f"time_lag_{index}" for index in range(1, HISTORY_SIZE + 1)]
RECENCY_FEATURES = [f"days_ago_lag_{index}" for index in range(1, HISTORY_SIZE + 1)]
FEATURE_NAMES = [
    *LAG_FEATURES,
    *RECENCY_FEATURES,
    "history_count", "forecast_days", "latest_time", "days_since_last_race",
    "best_3", "mean_3", "best_5", "mean_5", "std_5", "slope_5",
    "best_10", "mean_10", "std_10", "slope_10",
    "best_20", "mean_20", "std_20", "slope_20",
    "age", "sex_female", "sex_male", "taper_days", "swim_sessions_per_week",
]
REQUIRED_COLUMNS = {
    "athlete_id", "race_date", "course", "time_seconds", "age", "sex",
    "taper_days", "swim_sessions_per_week",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path("src/lib/models/100-free-xgboost.json"))
    parser.add_argument("--min-history", type=int, default=3)
    parser.add_argument("--min-rows", type=int, default=100)
    parser.add_argument("--min-athletes", type=int, default=15)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def load_data(paths: list[Path]) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for path in paths:
        frame = pd.read_csv(path)
        missing = REQUIRED_COLUMNS.difference(frame.columns)
        if missing:
            raise ValueError(f"{path} is missing columns: {', '.join(sorted(missing))}")
        frames.append(frame[list(REQUIRED_COLUMNS)].copy())

    data = pd.concat(frames, ignore_index=True)
    data["athlete_id"] = data["athlete_id"].astype(str).str.strip()
    data["race_date"] = pd.to_datetime(data["race_date"], errors="raise", utc=True).dt.tz_localize(None)
    data["course"] = data["course"].astype(str).str.upper().str.strip()
    data["sex"] = data["sex"].astype(str).str.upper().str.strip()
    for column in ("time_seconds", "age", "taper_days", "swim_sessions_per_week"):
        data[column] = pd.to_numeric(data[column], errors="coerce")

    data = data[
        data["course"].isin(COURSES)
        & data["sex"].isin(("FEMALE", "MALE"))
        & data["athlete_id"].ne("")
        & data["time_seconds"].between(35, 240)
        & data["age"].between(6, 100)
        & data["taper_days"].between(0, 28)
        & data["swim_sessions_per_week"].between(0, 14)
    ]
    data = data.drop_duplicates(
        subset=["athlete_id", "race_date", "course", "time_seconds"], keep="last"
    )
    return data.sort_values(["athlete_id", "course", "race_date"]).reset_index(drop=True)


def slope_per_day(window: pd.DataFrame) -> float:
    if len(window) < 2:
        return math.nan
    days = (window["race_date"] - window["race_date"].iloc[0]).dt.days.to_numpy(dtype=float)
    times = window["time_seconds"].to_numpy(dtype=float)
    if np.all(days == days[0]):
        return 0.0
    return float(np.polyfit(days, times, 1)[0])


def window_features(history: pd.DataFrame, size: int) -> dict[str, float]:
    window = history.tail(size)
    times = window["time_seconds"]
    return {
        f"best_{size}": float(times.min()),
        f"mean_{size}": float(times.mean()),
        f"std_{size}": float(times.std(ddof=1)) if len(times) > 1 else math.nan,
        f"slope_{size}": slope_per_day(window),
    }


def build_feature_row(history: pd.DataFrame, target: pd.Series) -> dict[str, Any]:
    history = history.tail(HISTORY_SIZE).copy()
    reverse = history.iloc[::-1].reset_index(drop=True)
    target_date = target["race_date"]
    latest_date = history["race_date"].iloc[-1]
    row: dict[str, Any] = {}

    for index in range(HISTORY_SIZE):
        row[LAG_FEATURES[index]] = float(reverse["time_seconds"].iloc[index]) if index < len(reverse) else math.nan
        row[RECENCY_FEATURES[index]] = int((target_date - reverse["race_date"].iloc[index]).days) if index < len(reverse) else math.nan

    row.update({
        "history_count": len(history),
        "forecast_days": max(1, int((target_date - latest_date).days)),
        "latest_time": float(history["time_seconds"].iloc[-1]),
        "days_since_last_race": max(1, int((target_date - latest_date).days)),
        "age": float(target["age"]),
        "sex_female": 1.0 if target["sex"] == "FEMALE" else 0.0,
        "sex_male": 1.0 if target["sex"] == "MALE" else 0.0,
        "taper_days": float(target["taper_days"]),
        "swim_sessions_per_week": float(target["swim_sessions_per_week"]),
    })
    for size in (3, 5, 10, 20):
        features = window_features(history, size)
        if size == 3:
            row["best_3"] = features["best_3"]
            row["mean_3"] = features["mean_3"]
        else:
            row.update(features)
    row.update({
        "target_time": float(target["time_seconds"]),
        "target_date": target_date,
        "athlete_id": target["athlete_id"],
        "course": target["course"],
    })
    return row


def build_examples(data: pd.DataFrame, min_history: int) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, group in data.groupby(["athlete_id", "course"], sort=False):
        group = group.sort_values("race_date").reset_index(drop=True)
        for target_index in range(min_history, len(group)):
            target = group.iloc[target_index]
            prior = group.iloc[:target_index]
            if (prior["race_date"] < target["race_date"]).all():
                rows.append(build_feature_row(prior, target))
    return pd.DataFrame(rows)


def make_model(seed: int, base_score: float) -> XGBRegressor:
    return XGBRegressor(
        objective="reg:absoluteerror", eval_metric="mae", n_estimators=650,
        learning_rate=0.03, max_depth=4, min_child_weight=8, subsample=0.82,
        colsample_bytree=0.82, reg_alpha=0.1, reg_lambda=5.0,
        tree_method="hist", base_score=base_score, random_state=seed, n_jobs=1,
    )


def baseline_predictions(frame: pd.DataFrame) -> dict[str, np.ndarray]:
    trend = frame["latest_time"].to_numpy() + frame["slope_5"].fillna(0).to_numpy() * frame["forecast_days"].to_numpy()
    return {
        "last_race": frame["latest_time"].to_numpy(),
        "mean_last_3": frame["mean_3"].to_numpy(),
        "five_race_trend": np.maximum(1, trend),
    }


def rolling_date_folds(frame: pd.DataFrame, requested_folds: int) -> list[tuple[np.ndarray, np.ndarray]]:
    dates = frame["target_date"].drop_duplicates().sort_values().to_numpy(dtype="datetime64[ns]")
    if len(dates) < 8:
        return []
    fold_count = min(requested_folds, max(2, len(dates) // 3))
    validation_size = max(1, len(dates) // (fold_count + 2))
    first_validation = len(dates) - fold_count * validation_size
    folds: list[tuple[np.ndarray, np.ndarray]] = []
    for fold in range(fold_count):
        start = first_validation + fold * validation_size
        end = len(dates) if fold == fold_count - 1 else start + validation_size
        validation_dates = dates[start:end]
        train_indices = np.flatnonzero(frame["target_date"].to_numpy() < validation_dates[0])
        validation_indices = np.flatnonzero(np.isin(frame["target_date"].to_numpy(), validation_dates))
        if len(train_indices) >= 20 and len(validation_indices) >= 5:
            folds.append((train_indices, validation_indices))
    return folds


def evaluate_rolling(frame: pd.DataFrame, seed: int, folds: int) -> dict[str, Any]:
    y = frame["target_time"].to_numpy(dtype=float)
    predictions = np.full(len(frame), np.nan)
    baseline_values = {name: np.full(len(frame), np.nan) for name in baseline_predictions(frame)}
    fold_list = rolling_date_folds(frame, folds)
    for train_indices, validation_indices in fold_list:
        train = frame.iloc[train_indices]
        validation = frame.iloc[validation_indices]
        model = make_model(seed, float(train["target_time"].mean()))
        model.fit(train[FEATURE_NAMES], train["target_time"])
        predictions[validation_indices] = model.predict(validation[FEATURE_NAMES])
        for name, values in baseline_predictions(validation).items():
            baseline_values[name][validation_indices] = values

    valid = ~np.isnan(predictions)
    if not valid.any():
        return {"mae": math.inf, "residuals": np.array([]), "signed_residuals": np.array([]), "baselines": {}, "fold_count": 0}
    signed_residuals = y[valid] - predictions[valid]
    residuals = np.abs(signed_residuals)
    baselines = {name: float(mean_absolute_error(y[valid], values[valid])) for name, values in baseline_values.items()}
    return {
        "mae": float(mean_absolute_error(y[valid], predictions[valid])),
        "residuals": residuals,
        "signed_residuals": signed_residuals,
        "baselines": baselines,
        "fold_count": len(fold_list),
    }


def evaluate_new_athletes(frame: pd.DataFrame, seed: int) -> float:
    athlete_count = frame["athlete_id"].nunique()
    if athlete_count < 2:
        return math.inf
    splitter = GroupKFold(n_splits=min(5, athlete_count))
    predictions = np.full(len(frame), np.nan)
    for train_indices, validation_indices in splitter.split(frame, groups=frame["athlete_id"]):
        train = frame.iloc[train_indices]
        validation = frame.iloc[validation_indices]
        model = make_model(seed, float(train["target_time"].mean()))
        model.fit(train[FEATURE_NAMES], train["target_time"])
        predictions[validation_indices] = model.predict(validation[FEATURE_NAMES])
    return float(mean_absolute_error(frame["target_time"], predictions))


def normalize_tree(node: dict[str, Any]) -> dict[str, Any]:
    if "leaf" in node:
        return {
            "nodeid": int(node["nodeid"]), "cover": float(node["cover"]),
            "leaf": float(node["leaf"]),
        }
    return {
        "nodeid": int(node["nodeid"]), "cover": float(node["cover"]),
        "split": str(node["split"]),
        "splitCondition": float(node["split_condition"]), "yes": int(node["yes"]),
        "no": int(node["no"]), "missing": int(node["missing"]),
        "children": [normalize_tree(child) for child in node.get("children", [])],
    }


def evaluate_exported_tree(node: dict[str, Any], row: pd.Series) -> float:
    if "leaf" in node:
        return float(node["leaf"])
    value = row[node["split"]]
    next_id = (
        node["missing"]
        if pd.isna(value)
        else node["yes"]
        if np.float32(value) < np.float32(node["splitCondition"])
        else node["no"]
    )
    child = next(child for child in node["children"] if child["nodeid"] == next_id)
    return evaluate_exported_tree(child, row)


def export_model(model: XGBRegressor, frame: pd.DataFrame, base_score: float) -> list[dict[str, Any]]:
    trees = [normalize_tree(json.loads(tree)) for tree in model.get_booster().get_dump(dump_format="json", with_stats=True)]
    sample = frame[FEATURE_NAMES].head(20)
    native = model.predict(sample)
    exported = np.array([base_score + sum(evaluate_exported_tree(tree, row) for tree in trees) for _, row in sample.iterrows()])
    if not np.allclose(native, exported, atol=5e-4):
        raise RuntimeError(f"Runtime export parity failed (max error {np.max(np.abs(native - exported))})")
    return trees


def fingerprint(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths, key=lambda item: str(item)):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def finite_or_zero(value: float) -> float:
    return round(value, 6) if math.isfinite(value) else 0.0


def main() -> None:
    args = parse_args()
    examples = build_examples(load_data(args.inputs), args.min_history)
    models: dict[str, Any] = {}

    for course in COURSES if not examples.empty else ():
        frame = examples[examples["course"] == course].sort_values("target_date").reset_index(drop=True)
        athlete_count = int(frame["athlete_id"].nunique()) if not frame.empty else 0
        if len(frame) < 20 or athlete_count < 2:
            continue
        rolling = evaluate_rolling(frame, args.seed, args.folds)
        new_athlete_mae = evaluate_new_athletes(frame, args.seed)
        best_baseline = min(rolling["baselines"].values(), default=math.inf)
        validated = (
            len(frame) >= args.min_rows and athlete_count >= args.min_athletes
            and rolling["fold_count"] >= 3 and math.isfinite(rolling["mae"])
            and rolling["mae"] <= best_baseline * 0.98 and math.isfinite(new_athlete_mae)
        )
        base_score = float(frame["target_time"].mean())
        final_model = make_model(args.seed, base_score)
        final_model.fit(frame[FEATURE_NAMES], frame["target_time"])
        residual_p80 = float(np.quantile(rolling["residuals"], 0.8)) if len(rolling["residuals"]) else 0.0
        residual_quantiles = [
            {"probability": probability, "residual": round(float(np.quantile(rolling["signed_residuals"], probability)), 6)}
            for probability in (0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95)
        ] if len(rolling["signed_residuals"]) else []
        models[course] = {
            "status": "VALIDATED" if validated else "EXPERIMENTAL",
            "baseScore": round(base_score, 8),
            "trees": export_model(final_model, frame, base_score),
            "metrics": {
                "rollingMae": finite_or_zero(rolling["mae"]),
                "newAthleteMae": finite_or_zero(new_athlete_mae),
                "bestBaselineMae": finite_or_zero(best_baseline),
                "residualP80": round(residual_p80, 6),
                "residualQuantiles": residual_quantiles,
                "trainingRows": len(frame), "athleteCount": athlete_count,
                "foldCount": rolling["fold_count"],
            },
        }

    statuses = [model["status"] for model in models.values()]
    artifact_status = "UNTRAINED" if not statuses else "VALIDATED" if all(status == "VALIDATED" for status in statuses) else "PARTIALLY_VALIDATED"
    trained_at = pd.Timestamp.utcnow()
    artifact = {
        "schemaVersion": 2,
        "version": f"100-free-xgb-{trained_at.strftime('%Y%m%d-%H%M%S')}",
        "trainedAt": trained_at.isoformat(),
        "event": "100 Freestyle", "status": artifact_status,
        "featureNames": FEATURE_NAMES,
        "trainingDataFingerprint": fingerprint(args.inputs), "models": models,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    summary = {course: model["metrics"] | {"status": model["status"]} for course, model in models.items()}
    print(json.dumps({"output": str(args.output), "status": artifact_status, "courses": summary}, indent=2))


if __name__ == "__main__":
    main()
