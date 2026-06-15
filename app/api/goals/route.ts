import { badRequest, created, unauthorized, validationError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { createGoal } from "@/lib/services/swim-service";
import { goalSchema, parseJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before saving goals.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before goals can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(goalSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const goal = await createGoal({
    userId: context.userId,
    ...parsed.data
  });

  return created({ goal });
}
