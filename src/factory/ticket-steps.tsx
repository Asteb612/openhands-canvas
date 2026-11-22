import { Check } from "lucide-react";
import { cn } from "#/utils/utils";
import type { FactoryTicket } from "./ticket";

const TONE: Record<string, string> = {
  done: "text-muted",
  current: "bg-surface-raised font-medium text-content",
  review: "bg-warning-soft font-medium text-warning-soft-foreground",
  todo: "text-muted opacity-60",
};

/** Steps of a ticket's workflow (done, current, waiting for review, to do). */
export function TicketSteps({
  steps,
  testId,
}: {
  steps: FactoryTicket["steps"];
  testId?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <ol className="flex flex-wrap gap-1" data-testid={testId}>
      {steps.map((s) => (
        <li
          key={s.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border px-2 text-xs leading-5",
            TONE[s.status],
          )}
        >
          {s.status === "done" && <Check className="size-3" aria-hidden />}
          {s.label}
        </li>
      ))}
    </ol>
  );
}
