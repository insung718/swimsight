import { z } from "zod";
import { supportedEvents } from "@/lib/events";

export const swimEventSchema = z.enum(supportedEvents);
export const courseSchema = z.enum(["SCM", "LCM", "SCY"]);
export const swimResultKindSchema = z.enum(["OFFICIAL", "TRAINING"]);
export const gymWorkoutTypeSchema = z.enum(["STRENGTH", "CORE", "MOBILITY", "DRYLAND", "CARDIO", "RECOVERY"]);

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

export const manualSwimSchema = z.object({
  date: dateSchema,
  event: swimEventSchema,
  course: courseSchema.default("LCM"),
  timeSeconds: z.number().finite().positive().max(7_200),
  meetName: cleanText(1, 120),
  resultKind: swimResultKindSchema.default("OFFICIAL"),
  notes: cleanText(1, 500).optional()
}).strict();

export const goalSchema = z.object({
  event: swimEventSchema,
  targetTime: z.number().finite().positive().max(7_200),
  targetDate: dateSchema
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
  age: z.number().int().min(6).max(100).optional()
}).strict().superRefine((value, context) => {
  if (value.role === "ATHLETE" && !value.age) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Age is required for swimmer analytics.",
      path: ["age"]
    });
  }
});

export const dashboardViewModeSchema = z.object({
  viewMode: z.enum(["swimmer", "coach"])
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
