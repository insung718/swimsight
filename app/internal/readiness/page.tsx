import { notFound } from "next/navigation";
import { InternalReadinessDashboard } from "@/components/internal-readiness-dashboard";
import { getAuthContext } from "@/lib/auth-context";
import { buildDatasetReadiness, listResearchCohortManifests } from "@/lib/services/data-foundation-service";
import { listActivePilotCohorts } from "@/lib/services/pilot-service";

export const dynamic = "force-dynamic";

export default async function InternalReadinessPage() {
  const context = await getAuthContext();
  if (!context || context.role !== "ADMIN") notFound();
  const [readiness, manifests, pilots] = await Promise.all([buildDatasetReadiness(), listResearchCohortManifests(), listActivePilotCohorts(true)]);
  return <InternalReadinessDashboard initialManifests={JSON.parse(JSON.stringify(manifests))} initialPilots={JSON.parse(JSON.stringify(pilots))} readiness={readiness} />;
}
