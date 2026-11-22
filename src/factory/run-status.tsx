import React from "react";
import { cn } from "#/utils/utils";
import { useRuns, type FactoryRun } from "./workflows/api";

/** Generic run statuses of the orchestrator, as shown in the UI. */
export const RUN_STATE: Record<
  string,
  { label: string; icon: string; tone: string }
> = {
  QUEUED: { label: "en file", icon: "○", tone: "text-muted border-border" },
  BLOCKED: { label: "bloqué", icon: "⛔", tone: "text-muted border-border" },
  ACTIVE: {
    label: "en cours",
    icon: "⏳",
    tone: "text-foreground border-border",
  },
  HUMAN: {
    label: "à valider",
    icon: "👀",
    tone: "text-feedback-warning border-feedback-warning",
  },
  WAITING: {
    label: "en attente",
    icon: "⌛",
    tone: "text-muted border-border",
  },
  COMPLETED: {
    label: "terminé",
    icon: "✅",
    tone: "text-status-success border-border",
  },
  FAILED: {
    label: "échec",
    icon: "✗",
    tone: "text-status-error border-status-error",
  },
  CANCELLED: { label: "annulé", icon: "⊘", tone: "text-muted border-border" },
};

export function runStateOf(state: string) {
  return RUN_STATE[state] ?? RUN_STATE.ACTIVE!;
}

/** Latest run of a conversation (runs are listed most recent first). */
export function useConversationRun(
  conversationId: string | undefined,
): FactoryRun | undefined {
  const { data } = useRuns();
  return React.useMemo(
    () =>
      conversationId
        ? data?.find((r) => r.conversationId === conversationId)
        : undefined,
    [data, conversationId],
  );
}

export function RunStateChip({
  state,
  className,
  testId,
}: {
  state: string;
  className?: string;
  testId?: string;
}) {
  const s = runStateOf(state);
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 text-3xs leading-4",
        s.tone,
        className,
      )}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

/** Sidebar badge: the factory status of a conversation, if it is a ticket's. */
export function FactoryRunBadge({
  conversationId,
}: {
  conversationId: string;
}) {
  const run = useConversationRun(conversationId);
  if (!run) return null;
  return (
    <span title={`${run.workflow} · ${run.node ?? ""}`}>
      <RunStateChip
        state={run.state}
        testId={`factory-run-badge-${conversationId}`}
      />
    </span>
  );
}
