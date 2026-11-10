"use client";

import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";

/** A quiet text link under a card title that opens an explanation or a related tool */
export function CardHelpLink({ onClick, children, icon: Icon = HelpCircle }: { onClick: () => void; children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </button>
  );
}
