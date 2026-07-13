export interface ShapTreeNode {
  nodeid: number;
  cover: number;
  leaf?: number;
  split?: string;
  splitCondition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: ShapTreeNode[];
}

export interface ShapTreeModel {
  baseScore: number;
  trees: ShapTreeNode[];
}

export interface TreeShapExplanation {
  expectedValue: number;
  predictedValue: number;
  contributions: Record<string, number>;
  additiveResidual: number;
}

interface PathState {
  featureIndexes: number[];
  zeroFractions: number[];
  oneFractions: number[];
  weights: number[];
}

function clonePath(path: PathState): PathState {
  return {
    featureIndexes: [...path.featureIndexes],
    zeroFractions: [...path.zeroFractions],
    oneFractions: [...path.oneFractions],
    weights: [...path.weights]
  };
}

function extendPath(path: PathState, depth: number, zeroFraction: number, oneFraction: number, featureIndex: number) {
  path.featureIndexes[depth] = featureIndex;
  path.zeroFractions[depth] = zeroFraction;
  path.oneFractions[depth] = oneFraction;
  path.weights[depth] = depth === 0 ? 1 : 0;

  for (let index = depth - 1; index >= 0; index -= 1) {
    path.weights[index + 1] += oneFraction * path.weights[index] * (index + 1) / (depth + 1);
    path.weights[index] = zeroFraction * path.weights[index] * (depth - index) / (depth + 1);
  }
}

function unwindPath(path: PathState, depth: number, pathIndex: number) {
  const oneFraction = path.oneFractions[pathIndex];
  const zeroFraction = path.zeroFractions[pathIndex];
  let nextOnePortion = path.weights[depth];

  for (let index = depth - 1; index >= 0; index -= 1) {
    if (oneFraction !== 0) {
      const previousWeight = path.weights[index];
      path.weights[index] = nextOnePortion * (depth + 1) / ((index + 1) * oneFraction);
      nextOnePortion = previousWeight - path.weights[index] * zeroFraction * (depth - index) / (depth + 1);
    } else if (zeroFraction !== 0) {
      path.weights[index] = path.weights[index] * (depth + 1) / (zeroFraction * (depth - index));
    }
  }

  for (let index = pathIndex; index < depth; index += 1) {
    path.featureIndexes[index] = path.featureIndexes[index + 1];
    path.zeroFractions[index] = path.zeroFractions[index + 1];
    path.oneFractions[index] = path.oneFractions[index + 1];
  }
}

function unwoundPathSum(path: PathState, depth: number, pathIndex: number) {
  const oneFraction = path.oneFractions[pathIndex];
  const zeroFraction = path.zeroFractions[pathIndex];
  let nextOnePortion = path.weights[depth];
  let total = 0;

  for (let index = depth - 1; index >= 0; index -= 1) {
    if (oneFraction !== 0) {
      const next = nextOnePortion * (depth + 1) / ((index + 1) * oneFraction);
      total += next;
      nextOnePortion = path.weights[index] - next * zeroFraction * (depth - index) / (depth + 1);
    } else if (zeroFraction !== 0) {
      total += path.weights[index] * (depth + 1) / (zeroFraction * (depth - index));
    }
  }

  return total;
}

function childFor(node: ShapTreeNode, nodeId: number | undefined) {
  return node.children?.find((child) => child.nodeid === nodeId);
}

function evaluateTree(node: ShapTreeNode, values: Record<string, number | null | undefined>): number {
  if (typeof node.leaf === "number") return node.leaf;
  if (!node.split || typeof node.splitCondition !== "number") return 0;
  const value = values[node.split];
  const nextId = value === null || value === undefined || Number.isNaN(value)
    ? node.missing
    : Math.fround(value) < Math.fround(node.splitCondition)
      ? node.yes
      : node.no;
  const child = childFor(node, nextId);
  return child ? evaluateTree(child, values) : 0;
}

function expectedTreeValue(node: ShapTreeNode): number {
  if (typeof node.leaf === "number") return node.leaf;
  const children = node.children ?? [];
  const totalCover = children.reduce((sum, child) => sum + Math.max(child.cover, 0), 0);
  if (totalCover <= 0) return 0;
  return children.reduce((sum, child) => sum + expectedTreeValue(child) * Math.max(child.cover, 0) / totalCover, 0);
}

function explainTreeRecursive({
  node,
  values,
  featureIndexByName,
  contributions,
  path,
  depth,
  parentZeroFraction,
  parentOneFraction,
  parentFeatureIndex
}: {
  node: ShapTreeNode;
  values: Record<string, number | null | undefined>;
  featureIndexByName: Map<string, number>;
  contributions: number[];
  path: PathState;
  depth: number;
  parentZeroFraction: number;
  parentOneFraction: number;
  parentFeatureIndex: number;
}) {
  const currentPath = clonePath(path);
  extendPath(currentPath, depth, parentZeroFraction, parentOneFraction, parentFeatureIndex);

  if (typeof node.leaf === "number") {
    for (let pathIndex = 1; pathIndex <= depth; pathIndex += 1) {
      const featureIndex = currentPath.featureIndexes[pathIndex];
      const weight = unwoundPathSum(currentPath, depth, pathIndex);
      contributions[featureIndex] += weight *
        (currentPath.oneFractions[pathIndex] - currentPath.zeroFractions[pathIndex]) * node.leaf;
    }
    return;
  }

  if (!node.split || typeof node.splitCondition !== "number") return;
  const splitFeatureIndex = featureIndexByName.get(node.split);
  if (splitFeatureIndex === undefined) return;
  const value = values[node.split];
  const hotId = value === null || value === undefined || Number.isNaN(value)
    ? node.missing
    : Math.fround(value) < Math.fround(node.splitCondition)
      ? node.yes
      : node.no;
  const coldId = hotId === node.yes ? node.no : node.yes;
  const hot = childFor(node, hotId);
  const cold = childFor(node, coldId);
  if (!hot || !cold) return;

  const denominator = node.cover > 0 ? node.cover : hot.cover + cold.cover;
  const hotZeroFraction = denominator > 0 ? hot.cover / denominator : 0.5;
  const coldZeroFraction = denominator > 0 ? cold.cover / denominator : 0.5;
  let incomingZeroFraction = 1;
  let incomingOneFraction = 1;
  let nextDepth = depth;

  const repeatedPathIndex = currentPath.featureIndexes.slice(0, depth + 1).findIndex((featureIndex) => featureIndex === splitFeatureIndex);
  if (repeatedPathIndex >= 0) {
    incomingZeroFraction = currentPath.zeroFractions[repeatedPathIndex];
    incomingOneFraction = currentPath.oneFractions[repeatedPathIndex];
    unwindPath(currentPath, depth, repeatedPathIndex);
    nextDepth -= 1;
  }

  explainTreeRecursive({
    node: hot,
    values,
    featureIndexByName,
    contributions,
    path: currentPath,
    depth: nextDepth + 1,
    parentZeroFraction: hotZeroFraction * incomingZeroFraction,
    parentOneFraction: incomingOneFraction,
    parentFeatureIndex: splitFeatureIndex
  });
  explainTreeRecursive({
    node: cold,
    values,
    featureIndexByName,
    contributions,
    path: currentPath,
    depth: nextDepth + 1,
    parentZeroFraction: coldZeroFraction * incomingZeroFraction,
    parentOneFraction: 0,
    parentFeatureIndex: splitFeatureIndex
  });
}

export function explainTreeModel(
  model: ShapTreeModel,
  featureNames: string[],
  values: Record<string, number | null | undefined>
): TreeShapExplanation {
  const featureIndexByName = new Map(featureNames.map((name, index) => [name, index]));
  const contributions = featureNames.map(() => 0);
  const emptyPath: PathState = { featureIndexes: [], zeroFractions: [], oneFractions: [], weights: [] };

  for (const tree of model.trees) {
    explainTreeRecursive({
      node: tree,
      values,
      featureIndexByName,
      contributions,
      path: emptyPath,
      depth: 0,
      parentZeroFraction: 1,
      parentOneFraction: 1,
      parentFeatureIndex: -1
    });
  }

  const expectedValue = model.baseScore + model.trees.reduce((sum, tree) => sum + expectedTreeValue(tree), 0);
  const predictedValue = model.baseScore + model.trees.reduce((sum, tree) => sum + evaluateTree(tree, values), 0);
  const contributionMap = Object.fromEntries(featureNames.map((name, index) => [name, contributions[index]]));
  const explainedValue = expectedValue + contributions.reduce((sum, contribution) => sum + contribution, 0);

  return {
    expectedValue,
    predictedValue,
    contributions: contributionMap,
    additiveResidual: predictedValue - explainedValue
  };
}
