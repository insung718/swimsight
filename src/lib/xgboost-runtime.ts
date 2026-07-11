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
  featureNames: string[];
  models: Partial<Record<Course, ExportedCourseModel>>;
}

const artifact = rawArtifact as unknown as XgboostArtifact;

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
