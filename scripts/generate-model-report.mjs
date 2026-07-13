import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const artifactPath = process.argv[2] ?? "src/lib/models/100-free-xgboost.json";
const outputDirectory = process.argv[3] ?? "docs/generated";
const raw = await readFile(artifactPath, "utf8");
const artifact = JSON.parse(raw);
const hash = createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
const safeVersion = String(artifact.version ?? "unknown").replace(/[^a-zA-Z0-9._-]/g, "-");
const models = Object.entries(artifact.models ?? {});
const validatedModels = models.filter(([, model]) => model?.status === "VALIDATED");
const status = validatedModels.length === models.length && models.length > 0 ? "VALIDATED" : "PROVISIONAL_OR_UNTRAINED";
const generatedAt = new Date().toISOString();

const evaluation = {
  schemaVersion: "swimsight-evaluation-v1",
  generatedAt,
  sourceArtifact: artifactPath,
  sourceArtifactSha256: hash,
  modelVersion: artifact.version ?? "unknown",
  featureSchemaVersion: artifact.featureSchemaVersion ?? "UNRECORDED",
  trainingCodeVersion: artifact.trainingCodeVersion ?? "UNRECORDED",
  evaluationVersion: artifact.evaluationVersion ?? "UNRECORDED",
  event: artifact.event ?? "unknown",
  artifactStatus: artifact.status ?? "unknown",
  registryReleaseStatus: artifact.registryReleaseSnapshot?.status ?? "NOT_ATTACHED_TO_RELEASE_SNAPSHOT",
  evaluationStatus: status,
  validatedClaimsAvailable: status === "VALIDATED",
  methodology: {
    temporalValidation: "Rolling-origin folds. Every feature timestamp must precede its target race date.",
    athleteHoldout: "GroupKFold by athlete is reported separately from chronological validation.",
    baselines: ["current production champion", "last race", "last-three-race mean", "five-race linear trend", "conservative deterministic forecast"],
    calibration: "Signed residual quantiles are estimated only from out-of-time predictions.",
    leakageRules: [
      "Future target rows contribute only the outcome label and target date.",
      "Age, category, taper, and training frequency are taken from the latest prior record.",
      "Athlete identifiers and raw records are not exported into the browser artifact."
    ]
  },
  courses: Object.fromEntries(models.map(([course, model]) => [course, {
    status: model.status,
    metrics: model.metrics ?? null,
    validationComparison: typeof model.metrics?.rollingMae === "number" && typeof model.metrics?.newAthleteMae === "number"
      ? {
          rollingOriginMae: model.metrics.rollingMae,
          groupedAthleteMae: model.metrics.newAthleteMae,
          absoluteDifference: Math.round(Math.abs(model.metrics.rollingMae - model.metrics.newAthleteMae) * 1_000_000) / 1_000_000,
          interpretation: model.metrics.rollingMae > model.metrics.newAthleteMae * 1.15
            ? "Chronological performance is materially worse than athlete-group validation, which may indicate temporal drift or optimistic non-temporal validation."
            : model.metrics.newAthleteMae > model.metrics.rollingMae * 1.15
              ? "Transfer to unseen athletes is materially worse than chronological validation, which may indicate athlete-specific overfitting."
              : "Chronological and athlete-group MAE are similar at the current sample size."
        }
      : { status: "INSUFFICIENT_DATA", interpretation: "Both validation designs need finite out-of-sample metrics before discrepancies can be interpreted." }
  }])),
  limitations: [
    "No claim is validated for a course marked EXPERIMENTAL or for an UNTRAINED artifact.",
    "Retrospective metadata corrections cannot be excluded unless source systems provide recorded-at timestamps.",
    "Finish-time-only data cannot identify starts, turns, splits, stroke mechanics, illness, or causal training effects.",
    "Subgroup results are withheld when their configured minimum sample size is not met."
  ],
  reproducibility: {
    command: `python3 scripts/train-100-free-xgboost.py <consented-csv...> --output ${artifactPath}`,
    dependencyFile: "scripts/requirements-model.txt",
    randomSeed: 42
  }
};

const metricLines = models.length
  ? models.map(([course, model]) => `| ${course} | ${model.status} | ${model.metrics?.trainingRows ?? "Not available"} | ${model.metrics?.athleteCount ?? "Not available"} | ${model.metrics?.rollingMae ?? "Not validated"} |`).join("\n")
  : "| None | UNTRAINED | Not available | Not available | Not validated |";
const modelCard = `# SwimSight Model Card: ${artifact.version ?? "Unknown"}

Generated: ${generatedAt}

Artifact payload SHA-256: \`${hash}\`

Artifact status: **${artifact.status ?? "Unknown"}**

Registry release status: **${artifact.registryReleaseSnapshot?.status ?? "NOT_ATTACHED_TO_RELEASE_SNAPSHOT"}**
Evaluation status: **${status}**

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
${metricLines}

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

Run \`python3 scripts/train-100-free-xgboost.py <consented-csv...>\` with dependencies in \`scripts/requirements-model.txt\`. Preserve the emitted artifact, evaluation JSON, source fingerprints, code revision, and consent eligibility snapshot.
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, `evaluation-${safeVersion}.json`), `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, `model-card-${safeVersion}.md`), modelCard, "utf8");
process.stdout.write(`${JSON.stringify({ modelCard: path.join(outputDirectory, `model-card-${safeVersion}.md`), evaluation: path.join(outputDirectory, `evaluation-${safeVersion}.json`), status }, null, 2)}\n`);
