import { created } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createGoal } from "@/lib/services/swim-service";
import { goalSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, goalSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const goal = await createGoal({
      userId: account.context.userId,
      ...parsed.data
    });

    return created({ goal });
  } catch (error) {
    logServerError("Could not create goal", error);
    return databaseUnavailable();
  }
}
