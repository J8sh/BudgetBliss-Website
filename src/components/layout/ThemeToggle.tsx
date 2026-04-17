"use client";

import { useTheme } from "@/components/layout/ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEMES = ["light", "dark", "system"] as const;

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const current = THEMES.indexOf((theme ?? "system") as (typeof THEMES)[number]);
    const next = THEMES[(current + 1) % THEMES.length];
    setTheme(next ?? "system");
  }

  const Icon = ICONS[(theme ?? "system") as keyof typeof ICONS] ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Current theme: ${theme ?? "system"}. Click to switch.`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
