import { describe, expect, it } from "vitest";
import { predictionProfileSchema } from "@/lib/validation";

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
});
