import "server-only";
import type { Prisma, RaceEffort, TaperStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordProductEvent } from "@/lib/services/product-analytics-service";

export interface RaceFeedbackFields {
  taperStatus: TaperStatus;
  illness: boolean;
  injury: boolean;
  effort: RaceEffort;
  courseInformationCorrect: boolean | null;
  unusualCircumstances: string | null;
  predictionUseful: boolean | null;
}

function snapshot(fields: RaceFeedbackFields, source = "SELF_REPORTED"): Prisma.InputJsonObject {
  return {
    ...fields,
    unusualCircumstances: fields.unusualCircumstances,
    courseInformationCorrect: fields.courseInformationCorrect,
    predictionUseful: fields.predictionUseful,
    source,
    modelTrainingEligible: false,
    inclusionPolicy: null
  };
}

export async function listRaceFeedback(userId: string) {
  return prisma.raceFeedback.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      swimResult: { select: { id: true, date: true, event: true, course: true, timeSeconds: true, meetName: true } },
      revisions: { orderBy: { version: "desc" }, take: 20 }
    }
  });
}

export async function createRaceFeedback(userId: string, swimResultId: string, fields: RaceFeedbackFields) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.swimResult.findFirst({
      where: {
        id: swimResultId,
        userId,
        resultKind: "OFFICIAL",
        raceType: "INDIVIDUAL",
        evaluatedPredictions: { some: { userId, evaluatedAt: { not: null } } }
      },
      select: { id: true }
    });
    if (!result) throw new Error("FEEDBACK_RESULT_NOT_FOUND");
    const existing = await transaction.raceFeedback.findUnique({ where: { swimResultId }, select: { id: true } });
    if (existing) throw new Error("FEEDBACK_ALREADY_EXISTS");
    const feedback = await transaction.raceFeedback.create({
      data: { userId, swimResultId, ...fields, source: "SELF_REPORTED" }
    });
    await transaction.raceFeedbackRevision.create({
      data: {
        feedbackId: feedback.id,
        userId,
        version: 1,
        changeType: "CREATED",
        snapshot: snapshot(fields)
      }
    });
    await recordProductEvent({
      client: transaction,
      userId,
      eventName: "FEEDBACK_COMPLETED",
      properties: { predictionUsefulAnswered: fields.predictionUseful !== null },
      minimumIntervalMinutes: 5
    });
    return feedback;
  }, { isolationLevel: "Serializable" });
}

export async function updateRaceFeedback(userId: string, feedbackId: string, expectedVersion: number, fields: RaceFeedbackFields) {
  return prisma.$transaction(async (transaction) => {
    const feedback = await transaction.raceFeedback.findFirst({ where: { id: feedbackId, userId, deletedAt: null } });
    if (!feedback) throw new Error("FEEDBACK_NOT_FOUND");
    if (feedback.currentVersion !== expectedVersion) throw new Error("FEEDBACK_VERSION_CONFLICT");
    const nextVersion = expectedVersion + 1;
    const updated = await transaction.raceFeedback.update({
      where: { id: feedback.id },
      data: { ...fields, currentVersion: nextVersion }
    });
    await transaction.raceFeedbackRevision.create({
      data: {
        feedbackId: feedback.id,
        userId,
        version: nextVersion,
        changeType: "UPDATED",
        snapshot: snapshot(fields)
      }
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function deleteRaceFeedback(userId: string, feedbackId: string, expectedVersion: number) {
  return prisma.$transaction(async (transaction) => {
    const feedback = await transaction.raceFeedback.findFirst({ where: { id: feedbackId, userId, deletedAt: null } });
    if (!feedback) throw new Error("FEEDBACK_NOT_FOUND");
    if (feedback.currentVersion !== expectedVersion) throw new Error("FEEDBACK_VERSION_CONFLICT");
    const nextVersion = expectedVersion + 1;
    await transaction.raceFeedbackRevision.create({
      data: {
        feedbackId: feedback.id,
        userId,
        version: nextVersion,
        changeType: "DELETED",
        snapshot: {
          deletedAt: new Date().toISOString(),
          priorVersion: expectedVersion,
          modelTrainingEligible: false
        }
      }
    });
    await transaction.raceFeedback.update({
      where: { id: feedback.id },
      data: { deletedAt: new Date(), currentVersion: nextVersion }
    });
    return { deleted: true };
  }, { isolationLevel: "Serializable" });
}
