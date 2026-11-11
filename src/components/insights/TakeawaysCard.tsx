"use client";

import { ArrowRight, CircleCheck, CircleAlert, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import type { Insight, InsightAction } from "@/types/insights";

const TONE_ICONS = {
  good: { icon: CircleCheck, label: "Good sign", className: "text-green-600 dark:text-green-400" },
  watch: { icon: CircleAlert, label: "Worth a look", className: "text-amber-600 dark:text-amber-400" },
  neutral: { icon: Info, label: "Note", className: "text-muted-foreground" },
} as const;

const ACTION_LABELS: Record<InsightAction["type"], string> = {
  category: "See breakdown",
  categorize: "Sort stores",
  "budget-rule": "How this compares",
  review: "Review receipts",
};

interface TakeawaysCardProps {
  /** What this card is, shown from an info icon next to the title */
  info?: React.ReactNode;
  insights: Insight[];
  onAction: (action: InsightAction) => void;
  /** Show at most this many (the dashboard shows a few; the insights page shows all) */
  limit?: number;
  title?: string;
  footer?: React.ReactNode;
}

/** The plain-language summary: a few sentences, most important first, each with a next step */
export function TakeawaysCard({ insights, onAction, limit, title = "The short version", footer, info }: TakeawaysCardProps) {
  const shown = limit ? insights.slice(0, limit) : insights;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {title}
          {info && <InfoTip label={title}>{info}</InfoTip>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <ul className="divide-y divide-border">
          {shown.map((insight) => {
            const tone = TONE_ICONS[insight.tone];
            const Icon = tone.icon;
            return (
              <li key={insight.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.className}`} aria-label={tone.label} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  {insight.detail && <p className="mt-0.5 text-sm text-muted-foreground">{insight.detail}</p>}
                  {insight.action && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto gap-1 px-0 text-sm"
                      onClick={() => onAction(insight.action!)}
                    >
                      {ACTION_LABELS[insight.action.type]}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {footer}
      </CardContent>
    </Card>
  );
}
