"use client";

import { Waves } from "lucide-react";
import { useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { UserActions } from "@/components/auth/user-actions";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { StaggeredMenu } from "@/components/ui/staggered-menu";
import { cn } from "@/lib/utils";

export const publicNavItems = [
  { label: "Features", href: "/features" },
  { label: "Performance", href: "/performance" },
  { label: "Community", href: "/community" },
  { label: "Validation", href: "/validation" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" }
];

export function SiteNav({ immersive = false }: { immersive?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (!immersive) return;
    setScrolled(latest > 80);
  });

  const isImmersiveTop = immersive && !scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[120] backdrop-blur-2xl transition-[background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isImmersiveTop
          ? "border-b border-white/0 bg-transparent text-white"
          : "border-b border-black/5 bg-white/80 text-[#1d1d1f]"
      )}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
        <a className="flex items-center gap-2 text-sm font-semibold" href="/">
          <Waves aria-hidden className="h-5 w-5" />
          SwimSight
        </a>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <div className="hidden sm:block">
            <UserActions compact />
          </div>
          <StaggeredMenu items={publicNavItems} />
        </div>
      </div>
    </header>
  );
}
