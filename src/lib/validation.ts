import { z } from "zod";
import { supportedEvents } from "@/lib/events";

export const swimEventSchema = z.enum(supportedEvents);
export const courseSchema = z.enum(["SCM", "LCM", "SCY"]);

const dateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date must be valid.");

export const manualSwimSchema = z.object({
  date: dateSchema,
  event: swimEventSchema,
  course: courseSchema.default("LCM"),
  timeSeconds: z.number().positive().max(7_200),
  meetName: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).optional()
});

export const goalSchema = z.object({
  event: swimEventSchema,
  targetTime: z.number().positive().max(7_200),
  targetDate: dateSchema
});

export const communityCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional()
});

export const communityJoinSchema = z.object({
  joinCode: z.string().trim().min(5).max(24)
});

export const friendRequestSchema = z.object({
  email: z.string().trim().email()
});

export const friendActionSchema = z.object({
  friendshipId: z.string().trim().min(1),
  action: z.enum(["accept", "block"])
});

export const upcomingMeetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).optional(),
  startDate: dateSchema,
  targetEvents: z.array(swimEventSchema).max(8).default([]),
  notes: z.string().trim().max(500).optional()
});

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
