import React from "react";
import { useRuns, type FactoryRun } from "./api";
import { useFactoryT } from "./i18n";
import { useSelectedProject } from "./project-context";
import { stateLook } from "./states";
import { Pill } from "./ui";

/** Run state pill, the same in the dashboard, the banner and the conversation list. */
export function RunStateChip({
  state,
  testId,
}: {
  state: string;
  testId?: string;
}) {
  const t = useFactoryT();
  const { label, tone, Icon } = stateLook(state);
  return (
    <Pill
      tone={tone}
      icon={<Icon className="size-3" aria-hidden />}
      testId={testId}
    >
      {t(label)}
    </Pill>
  );
}

/**
 * Latest run of a conversation of the active project (conversation ids belong to one
 * Agent Server: a run of another project never matches).
 */
export function useConversationRun(
  conversationId: string | undefined,
): FactoryRun | undefined {
  const { projectId } = useSelectedProject();
  const { data } = useRuns();
  return React.useMemo(
    () =>
      conversationId && projectId
        ? data?.find(
            (r) =>
              r.conversationId === conversationId && r.project === projectId,
          )
        : undefined,
    [data, conversationId, projectId],
  );
}

/** Conversation list badge: the factory state of a conversation, if it is a ticket's. */
export function FactoryRunBadge({
  conversationId,
}: {
  conversationId: string;
}) {
  const run = useConversationRun(conversationId);
  if (!run) return null;
  return (
    <span
      title={`${run.workflowName ?? run.workflow}${run.nodeLabel ? ` · ${run.nodeLabel}` : ""}`}
    >
      <RunStateChip
        state={run.state}
        testId={`factory-run-badge-${conversationId}`}
      />
    </span>
  );
}
