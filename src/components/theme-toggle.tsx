"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("swimsight-theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      aria-label="Toggle dark mode"
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-navy-100 bg-white text-navy-700 transition hover:border-aqua-400 hover:text-aqua-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
      title="Toggle dark mode"
      type="button"
      onClick={toggleTheme}
    >
      {isDark ? <Sun aria-hidden className="h-5 w-5" /> : <Moon aria-hidden className="h-5 w-5" />}
    </button>
  );
}
