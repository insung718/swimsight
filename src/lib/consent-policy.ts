import type { ConsentPurpose } from "@prisma/client";

export const CONSENT_POLICY_VERSIONS: Record<ConsentPurpose, string> = {
  PERSONAL_ANALYTICS: "analytics-v1",
  MODEL_TRAINING: "training-v1",
  PUBLIC_RESEARCH: "research-v1",
  GUARDIAN: "guardian-v1"
};
