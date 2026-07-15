import { PublicValidationPage } from "@/components/public-validation-page";
import { getPublicValidationStatus } from "@/lib/services/public-validation-service";

export const dynamic = "force-dynamic";

export default async function ValidationPage() {
  return <PublicValidationPage status={await getPublicValidationStatus()} />;
}
