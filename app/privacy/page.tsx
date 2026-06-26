import { Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { SitePage } from "@/components/landing/site-page";

export default function PrivacyPage() {
  return (
    <SitePage
      accent="from-white to-[#e6f9ff]"
      body="SwimSight is designed around account-scoped data, protected APIs, strict validation, rate limits, and private community access."
      eyebrow="Privacy and security"
      sections={[
        {
          eyebrow: "Your account",
          title: "Only your data loads after sign-in.",
          body: "Dashboard requests are scoped to the signed-in athlete so another user cannot read your race history.",
          icon: LockKeyhole
        },
        {
          eyebrow: "Protected APIs",
          title: "Validation, origins, and rate limits.",
          body: "Public endpoints reject unexpected fields, oversized bodies, cross-origin writes, and excessive traffic.",
          icon: ShieldCheck
        },
        {
          eyebrow: "Data storage",
          title: "Production secrets stay server-side.",
          body: "Database keys and private API credentials belong in environment variables, never in public client code.",
          icon: Database
        }
      ]}
      title="Your performance belongs to you."
    />
  );
}
