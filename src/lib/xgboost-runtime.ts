import rawArtifact from "@/lib/models/100-free-xgboost.json";
import { hundredFreeFeatureNames, type HundredFreeFeatureVector } from "@/lib/prediction-features";
import type { Course } from "@/types/swim";

interface ExportedTreeNode {
  nodeid: number;
  leaf?: number;
  split?: string;
  splitCondition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: ExportedTreeNode[];
}

interface ExportedCourseModel {
  status: "VALIDATED" | "EXPERIMENTAL";
  baseScore: number;
  trees: ExportedTreeNode[];
  metrics: {
    rollingMae: number;
    newAthleteMae: number;
    bestBaselineMae: number;
    residualP80: number;
    trainingRows: number;
    athleteCount: number;
    foldCount: number;
  };
}

interface XgboostArtifact {
  schemaVersion: number;
  version: string;
  event: "100 Freestyle";
  status: "UNTRAINED" | "PARTIALLY_VALIDATED" | "VALIDATED";
  trainedAt?: string;
  featureNames: string[];
  models: Partial<Record<Course, ExportedCourseModel>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTreeNode(value: unknown, featureNames: Set<string>): value is ExportedTreeNode {
  if (!isRecord(value) || typeof value.nodeid !== "number") return false;
  if (typeof value.leaf === "number") return Number.isFinite(value.leaf);
  if (typeof value.split !== "string" || !featureNames.has(value.split) || typeof value.splitCondition !== "number" || !Number.isFinite(value.splitCondition)) return false;
  if (typeof value.yes !== "number" || typeof value.no !== "number" || typeof value.missing !== "number") return false;
  if (!Number.isInteger(value.yes) || !Number.isInteger(value.no) || !Number.isInteger(value.missing)) return false;
  if (!Array.isArray(value.children) || value.children.length === 0 || !value.children.every((child) => isTreeNode(child, featureNames))) return false;
  const childIds = new Set(value.children.map((child) => child.nodeid));
  return childIds.has(value.yes) && childIds.has(value.no) && childIds.has(value.missing);
}

export function validateXgboostArtifact(value: unknown): value is XgboostArtifact {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.event !== "100 Freestyle") return false;
  if (typeof value.version !== "string" || value.version.trim().length === 0) return false;
  if (!["UNTRAINED", "PARTIALLY_VALIDATED", "VALIDATED"].includes(String(value.status))) return false;
  if (value.trainedAt !== undefined && (typeof value.trainedAt !== "string" || Number.isNaN(Date.parse(value.trainedAt)))) return false;
  if (!Array.isArray(value.featureNames) || !value.featureNames.every((name) => typeof name === "string" && name.length > 0)) return false;
  if (new Set(value.featureNames).size !== value.featureNames.length) return false;
  if (!isRecord(value.models)) return false;
  const modelEntries = Object.entries(value.models);
  if (modelEntries.some(([course]) => !["LCM", "SCM", "SCY"].includes(course))) return false;
  if (value.status !== "UNTRAINED" && (!value.trainedAt || value.featureNames.length === 0 || modelEntries.length === 0)) return false;
  const featureNames = new Set(value.featureNames);

  return modelEntries.every(([, model]) => {
    if (!isRecord(model) || !["VALIDATED", "EXPERIMENTAL"].includes(String(model.status))) return false;
    if (typeof model.baseScore !== "number" || !Number.isFinite(model.baseScore) || !Array.isArray(model.trees) || model.trees.length === 0 || !model.trees.every((tree) => isTreeNode(tree, featureNames))) return false;
    if (!isRecord(model.metrics)) return false;
    const metrics = model.metrics;
    return ["rollingMae", "newAthleteMae", "bestBaselineMae", "residualP80", "trainingRows", "athleteCount", "foldCount"]
      .every((key) => typeof metrics[key] === "number" && Number.isFinite(metrics[key] as number) && (metrics[key] as number) >= 0);
  });
}

const artifact: XgboostArtifact = validateXgboostArtifact(rawArtifact)
  ? rawArtifact
  : { schemaVersion: 1, version: "invalid-artifact", event: "100 Freestyle", status: "UNTRAINED", featureNames: [], models: {} };

function evaluateTree(node: ExportedTreeNode, features: HundredFreeFeatureVector): number {
  if (typeof node.leaf === "number") return node.leaf;
  if (!node.split || typeof node.splitCondition !== "number" || !node.children) return 0;

  const value = features[node.split as keyof HundredFreeFeatureVector];
  const nextId = value === null || value === undefined
    ? node.missing
    : Math.fround(value) < Math.fround(node.splitCondition)
      ? node.yes
      : node.no;
  const child = node.children.find((candidate) => candidate.nodeid === nextId);
  return child ? evaluateTree(child, features) : 0;
}

function featureContractMatches() {
  return artifact.featureNames.length === hundredFreeFeatureNames.length &&
    artifact.featureNames.every((feature, index) => feature === hundredFreeFeatureNames[index]);
}

export function predictWithHundredFreeXgboost(course: Course, features: HundredFreeFeatureVector) {
  const model = artifact.models[course];
  if (!model || model.status !== "VALIDATED" || !featureContractMatches()) return null;

  const predictedTime = model.trees.reduce((sum, tree) => sum + evaluateTree(tree, features), model.baseScore);
  if (!Number.isFinite(predictedTime) || predictedTime <= 0) return null;

  return {
    predictedTime,
    version: artifact.version,
    trainingDate: artifact.trainedAt,
    metrics: model.metrics
  };
}

export function hundredFreeModelStatus(course: Course) {
  const model = artifact.models[course];
  return {
    artifactVersion: artifact.version,
    artifactStatus: artifact.status,
    courseStatus: model?.status ?? "UNTRAINED",
    featureContractMatches: featureContractMatches()
  };
}
