import { describe, expect, it } from "vitest";
import { buildProbabilitySet, probabilityFromForecast } from "@/lib/prediction-intelligence";
import { explainTreeModel, type ShapTreeNode } from "@/lib/tree-shap";

const stump: ShapTreeNode = {
  nodeid: 0,
  cover: 10,
  split: "x",
  splitCondition: 0,
  yes: 1,
  no: 2,
  missing: 1,
  children: [
    { nodeid: 1, cover: 4, leaf: -2 },
    { nodeid: 2, cover: 6, leaf: 3 }
  ]
};

describe("prediction intelligence", () => {
  it("produces exact additive TreeSHAP values for a golden stump", () => {
    const faster = explainTreeModel({ baseScore: 10, trees: [stump] }, ["x"], { x: -1 });
    const slower = explainTreeModel({ baseScore: 10, trees: [stump] }, ["x"], { x: 1 });

    expect(faster.expectedValue).toBeCloseTo(11, 8);
    expect(faster.predictedValue).toBeCloseTo(8, 8);
    expect(faster.contributions.x).toBeCloseTo(-3, 8);
    expect(faster.additiveResidual).toBeCloseTo(0, 8);
    expect(slower.predictedValue).toBeCloseTo(13, 8);
    expect(slower.contributions.x).toBeCloseTo(2, 8);
  });

  it("keeps repeated tree features additive", () => {
    const repeated: ShapTreeNode = {
      nodeid: 0,
      cover: 12,
      split: "x",
      splitCondition: 5,
      yes: 1,
      no: 4,
      missing: 1,
      children: [
        {
          nodeid: 1,
          cover: 7,
          split: "x",
          splitCondition: 2,
          yes: 2,
          no: 3,
          missing: 2,
          children: [
            { nodeid: 2, cover: 3, leaf: -2 },
            { nodeid: 3, cover: 4, leaf: 1 }
          ]
        },
        { nodeid: 4, cover: 5, leaf: 4 }
      ]
    };
    const explanation = explainTreeModel({ baseScore: 20, trees: [repeated] }, ["x"], { x: 3 });

    expect(explanation.predictedValue).toBe(21);
    expect(explanation.expectedValue + explanation.contributions.x).toBeCloseTo(21, 8);
    expect(explanation.additiveResidual).toBeCloseTo(0, 8);
  });

  it("derives monotonic probabilities from forecast uncertainty", () => {
    const residualQuantiles = [{ probability: 0.1, residual: -1 }, { probability: 0.5, residual: 0 }, { probability: 0.9, residual: 1 }];
    const easier = probabilityFromForecast({ point: 60, low: 59, high: 61, residualQuantiles, thresholdTime: 61 });
    const harder = probabilityFromForecast({ point: 60, low: 59, high: 61, residualQuantiles, thresholdTime: 59 });
    const set = buildProbabilitySet({ point: 60, low: 59, high: 61, pbTime: 60.5, goalTime: 59.5 });

    expect(easier.probability).toBeGreaterThan(harder.probability);
    expect(set.pb.probability).toBeGreaterThan(set.goal?.probability ?? 100);
    expect(set.pb.calibration).toBe("Provisional");
  });
});
