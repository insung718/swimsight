import { sha256, stableJson } from "@/lib/data-integrity";

export type IdentityDecision = {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  status: "AUTO_MATCHED" | "REVIEW_REQUIRED";
  reasonCodes: string[];
};

export type ImportedEntityIdentity = {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: "SOURCE_LINKED" | "CONTENT_DERIVED" | "REVIEW_REQUIRED";
  identityKey: string;
  reasonCodes: string[];
};

function identityTokens(value: string) {
  return new Set(value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / new Set([...left, ...right]).size;
}

export function assessImportedAthleteIdentity({
  accountName,
  sourceAthleteId,
  sourceName
}: {
  accountName: string;
  sourceAthleteId?: string;
  sourceName?: string;
}): IdentityDecision {
  if (!sourceName && !sourceAthleteId) {
    return {
      confidence: "HIGH",
      score: 1,
      status: "AUTO_MATCHED",
      reasonCodes: ["ACCOUNT_SCOPED_SINGLE_ATHLETE_IMPORT", "NO_CONFLICTING_SOURCE_IDENTITY"]
    };
  }

  if (!sourceName) {
    return {
      confidence: "MEDIUM",
      score: 0.72,
      status: "REVIEW_REQUIRED",
      reasonCodes: ["EXTERNAL_ID_WITHOUT_REVIEWABLE_NAME"]
    };
  }

  const accountTokens = identityTokens(accountName);
  const sourceTokens = identityTokens(sourceName);
  const score = jaccard(accountTokens, sourceTokens);
  if (score === 1) {
    return {
      confidence: "HIGH",
      score,
      status: "AUTO_MATCHED",
      reasonCodes: ["NORMALIZED_NAME_EXACT_MATCH", ...(sourceAthleteId ? ["SOURCE_ATHLETE_ID_PRESENT"] : [])]
    };
  }

  if (score >= 0.67) {
    return {
      confidence: "MEDIUM",
      score,
      status: "REVIEW_REQUIRED",
      reasonCodes: ["PARTIAL_NAME_MATCH", "HUMAN_CONFIRMATION_REQUIRED"]
    };
  }

  return {
    confidence: "LOW",
    score,
    status: "REVIEW_REQUIRED",
    reasonCodes: ["SOURCE_NAME_MISMATCH", "SILENT_MERGE_BLOCKED"]
  };
}

export function assessImportedMeetIdentity(input: {
  externalMeetId?: string;
  meetName: string;
  date: string;
}): ImportedEntityIdentity {
  if (input.externalMeetId) {
    return {
      confidence: "HIGH",
      status: "SOURCE_LINKED",
      identityKey: sha256(`source-meet-v1|${input.externalMeetId}`),
      reasonCodes: ["SOURCE_MEET_ID_PRESENT"]
    };
  }
  const normalizedName = input.meetName.normalize("NFKC").trim().toLocaleLowerCase("en");
  const incomplete = !normalizedName || normalizedName === "imported meet";
  return {
    confidence: incomplete ? "LOW" : "MEDIUM",
    status: incomplete ? "REVIEW_REQUIRED" : "CONTENT_DERIVED",
    identityKey: sha256(stableJson({ policy: "meet-name-date-v1", date: input.date, meetName: normalizedName })),
    reasonCodes: incomplete
      ? ["SOURCE_MEET_ID_MISSING", "MEET_NAME_MISSING", "ROW_CORRECTION_AVAILABLE"]
      : ["SOURCE_MEET_ID_MISSING", "NORMALIZED_MEET_NAME_AND_DATE_KEY", "USER_REVIEWABLE"]
  };
}

export function assessImportedResultIdentity(input: {
  externalResultId?: string;
  date: string;
  event: string;
  course: string;
  timeSeconds: number;
  meetIdentityKey: string;
}): ImportedEntityIdentity {
  if (input.externalResultId) {
    return {
      confidence: "HIGH",
      status: "SOURCE_LINKED",
      identityKey: sha256(`source-result-v1|${input.externalResultId}`),
      reasonCodes: ["SOURCE_RESULT_ID_PRESENT"]
    };
  }
  return {
    confidence: "MEDIUM",
    status: "CONTENT_DERIVED",
    identityKey: sha256(stableJson({
      policy: "result-content-v1",
      date: input.date,
      event: input.event,
      course: input.course,
      timeSeconds: input.timeSeconds,
      meetIdentityKey: input.meetIdentityKey
    })),
    reasonCodes: ["SOURCE_RESULT_ID_MISSING", "ACCOUNT_SCOPED_CONTENT_KEY", "NEAR_DUPLICATE_REVIEW_ENABLED"]
  };
}
