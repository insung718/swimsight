import { z } from "zod";
import { supportedEvents } from "@/lib/events";

export const swimEventSchema = z.enum(supportedEvents);
export const courseSchema = z.enum(["SCM", "LCM", "SCY"]);
export const swimResultKindSchema = z.enum(["OFFICIAL", "TRAINING"]);
export const swimRaceTypeSchema = z.enum(["INDIVIDUAL", "RELAY_SPLIT", "TIME_TRIAL", "CONVERTED"]);
export const gymWorkoutTypeSchema = z.enum(["STRENGTH", "CORE", "MOBILITY", "DRYLAND", "CARDIO", "RECOVERY"]);
export const athleteSexSchema = z.enum(["FEMALE", "MALE"]);

const cleanText = (min: number, max: number) => z
  .string()
  .trim()
  .min(min)
  .max(max)
  .transform((value) => Array.from(value.normalize("NFKC")).filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  }).join(""));

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
});

export const predictionProfileSchema = z.object({
  age: z.number().int().min(6).max(100).nullable(),
  sex: athleteSexSchema.nullable(),
  taperDays: z.number().int().min(0).max(28).nullable(),
  swimSessionsPerWeek: z.number().min(0).max(14).multipleOf(0.5).nullable()
}).strict();

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
