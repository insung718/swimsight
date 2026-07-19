# SwimSight Race Lab v1

Race Lab replays and compares existing race data. It does not introduce another machine-learning model. Existing SwimSight prediction outputs may appear as a comparison lane, while all what-if and goal-race calculations use deterministic rules in `src/lib/race-lab.ts`.

## Data provenance

- `OFFICIAL` splits are timing-source data and cannot be edited through the Race Lab API.
- `MANUAL` splits are entered by the athlete and stored separately from official splits.
- `ESTIMATED` splits are generated only when no valid official or manual pool-length splits exist. They are labeled as estimates and displayed at tenth-second precision.
- `SIMULATED` segments live inside an immutable scenario snapshot. They are never written over a source race or official split.
- A single-length race uses its official finish time as its only segment; no intermediate precision is inferred.

The preferred source order is official, manual, then estimated. The API scopes every race, split, and scenario query to the authenticated account. Clients cannot submit a user ID, official provenance, or projected finish time. Saved finish times and segments are recalculated on the server.

## Replay and comparison

The replay interpolates distance between known pool-length timestamps. This makes the marker move smoothly; it does not claim to reconstruct stroke-by-stroke position. Prediction and goal lanes use an estimated race shape and remain visibly labeled. LCM uses 50 m lengths, SCM uses 25 m lengths, and SCY uses 25 yd lengths.

Split comparisons report segment and cumulative differences. Positive values mean the selected race lost time against the reference; negative values mean it gained time. Missing references remain blank.

## Race-shape rules

Race-shape labels are descriptive, not medical or physiological claims. Version `race-lab-v1.0.0` uses these fixed thresholds:

| Pattern | Rule |
| --- | --- |
| Fast or slow start | First-length pace differs from the middle baseline by at least 3% |
| Even pacing | First and second halves differ by no more than 1.5% |
| Positive or negative split | Second half differs from first half by at least 2% |
| Late-race fade | Final-length pace is at least 4% slower than the recent segment baseline |
| Strong finish | Final-length pace is at least 3% faster than the recent segment baseline |
| Inconsistent middle | Middle-section coefficient of variation is at least 4% |

## What-if simulation

Simulation controls adjust the selected race deterministically. Reaction time uses a 0.70 s baseline proxy because Race Lab v1 does not store start-system reaction data. Turn and underwater controls are bounded proxies, not biomechanical measurements. Broad segment minimums reject clearly unrealistic values. Every output is labeled `Simulation`, and saved settings and segments are snapshotted together.

## Goal race builder

Goal splits blend explicit recent race shapes with a conservative event template. The fastest valid race among the eight most recent receives modest extra weight, keeping the target grounded in both the athlete's best recent execution and broader pacing history. If explicit source splits are unavailable, only the template is used and that limitation is shown. Aggressive, balanced, and conservative strategies shift the distribution across the race without changing the requested finish time. Athletes may edit every target segment, but the segments must remain plausible and sum to the goal time.

## Share card privacy

The exported image includes event, course, finish time, PB improvement, strongest and weakest segments, goal progress, and race-shape label. Athlete name, email, meet name, exact date, club, and account identifiers are excluded by default. Export copy supports English, Korean, and Vietnamese.

## Known limitations

- Race Lab v1 supports 50, 100, 200, and 400 distance events.
- Replay is pool-length based, not stroke-cycle or video reconstruction.
- Reaction, turn, and underwater values are proxies unless a future trusted timing source supplies those measurements.
- Estimated segments communicate a plausible race shape, not hidden timing-pad precision.
- Race-shape rules describe pacing only and should not be used for medical, fatigue, or injury conclusions.
