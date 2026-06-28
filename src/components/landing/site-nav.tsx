"use client";

import { Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { StaggeredMenu } from "@/components/ui/staggered-menu";

export const publicNavItems = [
  { label: "Features", href: "/features" },
  { label: "Performance", href: "/performance" },
  { label: "Community", href: "/community" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" }
];

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-[120] border-b border-black/5 bg-white/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
        <a className="flex items-center gap-2 text-sm font-semibold" href="/">
          <Waves aria-hidden className="h-5 w-5" />
          SwimSight
        </a>
        <div className="flex items-center gap-2">
          <UserActions compact />
          <StaggeredMenu items={publicNavItems} />
        </div>
      </div>
    </header>
  );
}
