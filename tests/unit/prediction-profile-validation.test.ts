import { describe, expect, it } from "vitest";
import { goalSchema, predictionProfileSchema } from "@/lib/validation";

describe("prediction profile validation", () => {
  it("accepts bounded model inputs", () => {
    expect(predictionProfileSchema.safeParse({
      age: 16,
      sex: "MALE",
      taperDays: 8,
      swimSessionsPerWeek: 6
    }).success).toBe(true);
  });

  it("rejects unexpected and implausible values", () => {
    expect(predictionProfileSchema.safeParse({
      age: 16,
      sex: "MALE",
      taperDays: 80,
      swimSessionsPerWeek: 30,
      userId: "another-user"
    }).success).toBe(false);
  });

  it("validates course-specific goals and optional qualifying standards", () => {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + 30);
    expect(goalSchema.safeParse({
      event: "100 Freestyle",
      course: "SCM",
      targetTime: 58,
      qualifyingTime: 57.5,
      targetDate: targetDate.toISOString().slice(0, 10)
    }).success).toBe(true);
    expect(goalSchema.safeParse({
      event: "100 Freestyle",
      course: "INVALID",
      targetTime: 58,
      targetDate: "2000-01-01"
    }).success).toBe(false);
  });
});
