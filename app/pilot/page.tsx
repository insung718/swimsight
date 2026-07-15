import { PilotPageShell } from "@/components/pilot-page-shell";
import { getAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function PilotPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, context] = await Promise.all([searchParams, getAuthContext()]);
  return <PilotPageShell initialToken={token} signedIn={Boolean(context)} />;
}
