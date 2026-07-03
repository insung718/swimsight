"use client";

import { ShieldCheck, Trophy, Users } from "lucide-react";
import { SitePage } from "@/components/landing/site-page";

export default function CommunityPage() {
  return (
    <SitePage
      accent="from-[#eefcff] to-white"
      body="Build a private swim circle for friends, school teams, or club lanes. Compare progress without making athlete data public."
      eyebrow="Community"
      sections={[
        {
          eyebrow: "Private groups",
          title: "Invite-only communities.",
          body: "Create a community, share the join code, and keep comparisons inside the group you choose.",
          icon: ShieldCheck
        },
        {
          eyebrow: "Friends",
          title: "Compare shared events.",
          body: "See where you and your friends overlap, where the time gaps are, and who is moving fastest.",
          icon: Users
        },
        {
          eyebrow: "Team energy",
          title: "Celebrate improvement.",
          body: "Leaderboards and most-improved views make progress visible without turning the app into noise.",
          icon: Trophy
        }
      ]}
      title="A better way to train together."
    />
  );
}
