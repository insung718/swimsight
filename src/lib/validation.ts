import { z } from "zod";
import { supportedEvents } from "@/lib/events";
import { isFormulaLike } from "@/lib/imports/csv-parser";

export const swimEventSchema = z.enum(supportedEvents);
export const courseSchema = z.enum(["SCM", "LCM", "SCY"]);
export const swimResultKindSchema = z.enum(["OFFICIAL", "TRAINING"]);
export const swimRaceTypeSchema = z.enum(["INDIVIDUAL", "RELAY_SPLIT", "TIME_TRIAL", "CONVERTED"]);
export const gymWorkoutTypeSchema = z.enum(["STRENGTH", "CORE", "MOBILITY", "DRYLAND", "CARDIO", "RECOVERY"]);
export const athleteSexSchema = z.enum(["FEMALE", "MALE"]);

function isUnsafeTextControl(character: string) {
  const code = character.codePointAt(0) ?? 0;
  return code <= 0x08
    || code === 0x0b
    || code === 0x0c
    || (code >= 0x0e && code <= 0x1f)
    || code === 0x7f
    || (code >= 0x202a && code <= 0x202e)
    || (code >= 0x2066 && code <= 0x2069);
}

const cleanText = (min: number, max: number) => z
  .string()
  .transform((value) => Array.from(value.normalize("NFKC")).filter((character) => !isUnsafeTextControl(character)).join("").trim())
  .pipe(z.string().min(min).max(max));

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date must be valid.");

const resultDateSchema = dateSchema.refine(
  (value) => value <= new Date().toISOString().slice(0, 10),
  "Result date cannot be in the future."
);

const goalDateSchema = dateSchema.refine(
  (value) => value >= new Date().toISOString().slice(0, 10),
  "Goal date cannot be in the past."
);

export const manualSwimSchema = z.object({
  date: resultDateSchema,
  event: swimEventSchema,
  course: courseSchema.default("LCM"),
  timeSeconds: z.number().finite().positive().max(7_200),
  meetName: cleanText(1, 120),
  resultKind: swimResultKindSchema.default("OFFICIAL"),
  raceType: swimRaceTypeSchema.default("INDIVIDUAL"),
  notes: cleanText(1, 500).optional()
}).strict();

export const goalSchema = z.object({
  event: swimEventSchema,
  course: courseSchema.default("LCM"),
  targetTime: z.number().finite().positive().max(7_200),
  qualifyingTime: z.number().finite().positive().max(7_200).nullable().optional(),
  targetDate: goalDateSchema
}).strict();

export const communityCreateSchema = z.object({
  name: cleanText(2, 80),
  description: cleanText(1, 240).optional()
}).strict();

export const communityJoinSchema = z.object({
  joinCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{5,24}$/)
}).strict();

export const friendRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254)
}).strict();

export const friendActionSchema = z.object({
  friendshipId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  action: z.enum(["accept", "block", "remove"])
}).strict();

export const profileRoleSchema = z.object({
  role: z.enum(["ATHLETE", "COACH"]),
  personalAnalyticsConsent: z.literal(true),
  age: z.number().int().min(6).max(100).optional(),
  sex: athleteSexSchema.optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  preferredCourse: courseSchema.optional(),
  mainEvents: z.array(swimEventSchema).max(5).default([]),
  taperDays: z.number().int().min(0).max(28).optional(),
  swimSessionsPerWeek: z.number().min(0).max(14).multipleOf(0.5).optional()
}).strict().superRefine((value, context) => {
  if (value.role === "ATHLETE" && !value.age) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Age is required for swimmer analytics.",
      path: ["age"]
    });
  }
  if (value.role === "ATHLETE" && !value.sex) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Performance category is required for swimmer analytics.",
      path: ["sex"]
    });
  }
  if (value.role === "ATHLETE" && !value.countryCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Country is required for coverage reporting.", path: ["countryCode"] });
  }
  if (value.role === "ATHLETE" && !value.preferredCourse) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Preferred course is required.", path: ["preferredCourse"] });
  }
  if (value.role === "ATHLETE" && value.mainEvents.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose at least one main event.", path: ["mainEvents"] });
  }
});

export const predictionProfileSchema = z.object({
  age: z.number().int().min(6).max(100).nullable(),
  sex: athleteSexSchema.nullable(),
  taperDays: z.number().int().min(0).max(28).nullable(),
  swimSessionsPerWeek: z.number().min(0).max(14).multipleOf(0.5).nullable()
}).strict();

const raceLabIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const simulationSettingsSchema = z.object({
  reactionTime: z.number().finite().min(0.45).max(1.5),
  firstSegmentAdjustment: z.number().finite().min(-2).max(3),
  middleSegmentAdjustment: z.number().finite().min(-1.25).max(2),
  finalSegmentAdjustment: z.number().finite().min(-1.5).max(2.5),
  turnAdjustment: z.number().finite().min(-0.4).max(0.8),
  underwaterEfficiency: z.number().finite().min(-1).max(1)
}).strict();

export const raceLabMutationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("SAVE_SPLITS"),
    raceId: raceLabIdSchema,
    cumulativeTimes: z.array(z.number().finite().positive().max(7_200)).min(1).max(16)
  }).strict(),
  z.object({
    mode: z.literal("GENERATE_ESTIMATE"),
    raceId: raceLabIdSchema
  }).strict(),
  z.object({
    mode: z.literal("SAVE_SIMULATION"),
    raceId: raceLabIdSchema,
    name: cleanText(1, 80),
    settings: simulationSettingsSchema
  }).strict(),
  z.object({
    mode: z.literal("SAVE_GOAL_RACE"),
    raceId: raceLabIdSchema,
    name: cleanText(1, 80),
    targetTime: z.number().finite().positive().max(7_200),
    strategy: z.enum(["AGGRESSIVE", "BALANCED", "CONSERVATIVE"]),
    segmentTimes: z.array(z.number().finite().positive().max(1_000)).min(1).max(16).optional()
  }).strict(),
  z.object({
    mode: z.literal("DELETE_SCENARIO"),
    scenarioId: raceLabIdSchema
  }).strict()
]);

export const raceLabQuerySchema = z.object({
  raceIds: z.string().trim().max(260).regex(/^[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+){0,3}$/).optional()
}).strict().transform((value) => ({
  raceIds: value.raceIds ? Array.from(new Set(value.raceIds.split(","))) : []
}));

export const dashboardViewModeSchema = z.object({
  viewMode: z.enum(["swimmer", "coach"])
}).strict();

export const consentMutationSchema = z.object({
  purpose: z.enum(["PERSONAL_ANALYTICS", "MODEL_TRAINING", "PUBLIC_RESEARCH", "GUARDIAN"]),
  action: z.enum(["GRANTED", "WITHDRAWN"]),
  policyVersion: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/i)
}).strict();

export const privacyDeletionSchema = z.object({
  scope: z.enum(["TRAINING_DATA", "ACCOUNT"]),
  confirmation: z.literal("DELETE")
}).strict();

const raceFeedbackFields = z.object({
  taperStatus: z.enum(["UNKNOWN", "TAPERED", "UNTAPERED"]),
  illness: z.boolean(),
  injury: z.boolean(),
  effort: z.enum(["UNKNOWN", "MAXIMUM", "SUBMAXIMAL", "TRAINING_PACE"]),
  courseInformationCorrect: z.boolean().nullable(),
  unusualCircumstances: cleanText(1, 500).nullable(),
  predictionUseful: z.boolean().nullable()
}).strict();

export const raceFeedbackCreateSchema = raceFeedbackFields.extend({
  swimResultId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
}).strict();

export const raceFeedbackUpdateSchema = raceFeedbackFields.extend({
  feedbackId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  expectedVersion: z.number().int().positive().max(10_000)
}).strict();

export const raceFeedbackDeleteSchema = z.object({
  feedbackId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  expectedVersion: z.number().int().positive().max(10_000)
}).strict();

export const modelMonitoringRefreshSchema = z.object({
  action: z.literal("REFRESH_MONITORING"),
  modelVersion: z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  event: swimEventSchema,
  course: courseSchema,
  ageBand: z.enum(["ALL", "10_AND_UNDER", "11_12", "13_14", "15_16", "17_18", "19_AND_OVER", "UNKNOWN"]).default("ALL"),
  category: z.enum(["ALL", "FEMALE", "MALE"]).default("ALL"),
  horizonBand: z.enum(["ALL", "0_30_DAYS", "31_90_DAYS", "91_180_DAYS", "181_365_DAYS"]).default("ALL"),
  minSample: z.number().int().min(20).max(1_000).default(30)
}).strict();

export const coachClubCreateSchema = z.object({
  name: cleanText(2, 96),
  description: cleanText(1, 240).optional()
}).strict();

export const coachClubJoinSchema = z.object({
  joinCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{5,24}$/)
}).strict();

export const coachClubShareMutationSchema = z.object({
  teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  action: z.enum(["GRANT", "WITHDRAW"])
}).strict();

export const coachNoteCreateSchema = z.object({
  teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  athleteId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  content: cleanText(1, 2_000)
}).strict();

export const coachNoteQuerySchema = z.object({
  teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  athleteId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
}).strict();

export const coachNoteDeleteSchema = z.object({
  teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  noteId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
}).strict();

export const rosterImportMutationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("PREVIEW"),
    teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    cohortId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    csv: z.string().min(1).max(200_000)
  }).strict(),
  z.object({
    mode: z.literal("COMMIT"),
    teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    cohortId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    csv: z.string().min(1).max(200_000),
    previewToken: z.string().trim().min(64).max(2_048).regex(/^[a-zA-Z0-9_.-]+$/)
  }).strict()
]);

export const pilotInviteCreateSchema = z.object({
  cohortId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  teamId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
  label: cleanText(2, 80),
  audience: z.enum(["INDIVIDUAL", "SCHOOL", "CLUB"]),
  maxUses: z.number().int().min(1).max(500),
  expiresAt: z.string().datetime().refine((value) => new Date(value).getTime() > Date.now(), "Invitation must expire in the future.")
}).strict();

export const pilotInviteRevokeSchema = z.object({
  invitationId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
}).strict();

const pilotTokenSchema = z.string().trim().min(24).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const pilotEnrollmentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PREVIEW"), token: pilotTokenSchema }).strict(),
  z.object({ mode: z.literal("ACCEPT"), token: pilotTokenSchema }).strict()
]);

export const pilotWithdrawalSchema = z.object({
  enrollmentId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
}).strict();

export const pilotCohortCreateSchema = z.object({
  name: cleanText(2, 100),
  label: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,39}$/),
  description: cleanText(1, 500).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional()
}).strict().refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt), {
  message: "Pilot end date must be after its start date.",
  path: ["endsAt"]
});

export const researchCohortBuildSchema = z.object({
  action: z.literal("CREATE_COHORT_MANIFEST"),
  extractionCutoff: z.string().datetime().refine((value) => new Date(value) <= new Date(), "Extraction cutoff cannot be in the future.")
}).strict();

const productEventPropertySchema = z.union([
  z.string().max(80),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

export const productEventMutationSchema = z.object({
  eventName: z.enum(["PREDICTION_VIEWED", "RETURN_VISIT"]),
  sessionId: z.string().trim().regex(/^[a-zA-Z0-9_-]{8,64}$/).optional(),
  properties: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/), productEventPropertySchema).refine(
    (value) => Object.keys(value).length <= 12,
    "Analytics events can include at most 12 properties."
  ).default({})
}).strict();

export const upcomingMeetSchema = z.object({
  name: cleanText(2, 120),
  location: cleanText(1, 120).optional(),
  startDate: dateSchema,
  targetEvents: z.array(swimEventSchema).max(8).default([]),
  notes: cleanText(1, 500).optional()
}).strict();

export const gymWorkoutSchema = z.object({
  date: dateSchema,
  workoutType: gymWorkoutTypeSchema,
  durationMinutes: z.number().int().positive().max(360),
  intensity: z.number().int().min(1).max(10),
  focus: cleanText(1, 80).optional(),
  notes: cleanText(1, 500).optional()
}).strict();

export const csvImportSchema = z.object({
  csv: z.string().min(1).max(100_000),
  resultKind: swimResultKindSchema.default("OFFICIAL"),
  persist: z.boolean().default(false)
}).strict();

const importAdapterSchema = z.enum(["SWIMSIGHT_CANONICAL", "GENERIC_RACE_CSV", "SWIMCLOUD_EXPORT"]);
const importColumnMappingSchema = z.object({
  date: cleanText(1, 80).optional(),
  event: cleanText(1, 80).optional(),
  time: cleanText(1, 80).optional(),
  course: cleanText(1, 80).optional(),
  meetName: cleanText(1, 80).optional(),
  resultKind: cleanText(1, 80).optional(),
  raceType: cleanText(1, 80).optional(),
  athleteName: cleanText(1, 80).optional(),
  athleteBirthYear: cleanText(1, 80).optional(),
  externalAthleteId: cleanText(1, 80).optional(),
  externalMeetId: cleanText(1, 80).optional(),
  externalResultId: cleanText(1, 80).optional(),
  sourceStatus: cleanText(1, 80).optional()
}).strict();

const importResultCorrectionSchema = manualSwimSchema.omit({ notes: true }).extend({
  athleteName: cleanText(1, 120).optional(),
  athleteBirthYear: z.number().int().min(1920).max(new Date().getUTCFullYear()).optional(),
  externalAthleteId: cleanText(1, 128).optional(),
  externalMeetId: cleanText(1, 128).optional(),
  externalResultId: cleanText(1, 128).optional(),
  sourceStatus: cleanText(1, 80).optional()
}).strict().superRefine((value, context) => {
  const distance = Number.parseInt(value.event.split(" ")[0] ?? "0", 10);
  const broadMinimum = distance * 0.15;
  const broadMaximum = Math.min(7_200, Math.max(300, distance * 4.8));
  if (distance && (value.timeSeconds < broadMinimum || value.timeSeconds > broadMaximum)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Corrected time is outside the broad plausibility range for this event.", path: ["timeSeconds"] });
  }
  for (const [field, raw] of Object.entries(value)) {
    if (typeof raw === "string" && isFormulaLike(raw)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Formula-like values are not accepted in import corrections.", path: [field] });
    }
  }
});

export const importMutationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("PREVIEW"),
    csv: z.string().min(1).max(1_500_000),
    sourceName: cleanText(1, 160).default("upload.csv"),
    defaultResultKind: swimResultKindSchema.default("OFFICIAL"),
    adapter: importAdapterSchema.optional(),
    columnMapping: importColumnMappingSchema.optional()
  }).strict(),
  z.object({
    mode: z.literal("COMMIT"),
    batchId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    rowIds: z.array(z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)).max(10_000).optional()
  }).strict(),
  z.object({
    mode: z.literal("ROLLBACK"),
    batchId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/)
  }).strict(),
  z.object({
    mode: z.literal("CORRECT_ROW"),
    batchId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    rowId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    result: importResultCorrectionSchema
  }).strict(),
  z.object({
    mode: z.literal("RESOLVE_IDENTITY"),
    batchId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    candidateId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    action: z.enum(["CONFIRM_SELF", "REJECT", "UNMERGE"])
  }).strict()
]);

export const communityIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

export function parseJsonBody<T>(schema: z.ZodSchema<T>, body: unknown) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  }

  return { ok: true as const, data: parsed.data };
}
