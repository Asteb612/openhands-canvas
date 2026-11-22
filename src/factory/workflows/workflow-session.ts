/**
 * Workflow sessions: a workflow written with the agent in a conversation. The agent
 * (Claude Code over ACP, no client tools) edits `.factory/workflow.json` in its
 * workspace; the orchestrator reads, validates and saves it (see orchestrator
 * src/workflow/sessions.ts). The conversation carries `factoryworkflowsession`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { factoryFetch, factoryKeys, QUIET } from "../api/client";
import type { Problem, ValidationResponse, WorkflowDefinition } from "../api";

export interface WorkflowSession {
  session: string;
  scope: string;
  workflowId: string | null;
  baseVersion: number | null;
  createdBy: string;
  createdAt: string;
  definition: WorkflowDefinition | null;
  ok: boolean;
  problems: Problem[];
  ports: ValidationResponse["ports"];
}

const enc = encodeURIComponent;

/** Session id and project of the open conversation, when it writes a workflow. */
export function useWorkflowSessionId(): {
  project: string;
  session: string;
} | null {
  const { data: conversation } = useActiveConversation();
  const tags = (
    conversation as { tags?: Record<string, string> | null } | undefined
  )?.tags;
  const session = tags?.factoryworkflowsession;
  const project = tags?.factoryproject;
  return session && project ? { project, session } : null;
}

/** The draft, validated by the orchestrator; polled while the agent works. */
export function useWorkflowSession(
  ref: { project: string; session: string } | null,
) {
  return useQuery({
    queryKey: ["factory", "workflow-session", ref?.project, ref?.session],
    enabled: !!ref,
    queryFn: () =>
      factoryFetch<WorkflowSession>(
        `/projects/${enc(ref!.project)}/workflow-sessions/${enc(ref!.session)}`,
      ),
    refetchInterval: 3000,
    retry: false,
    meta: QUIET,
  });
}

/** Starts a session: a conversation where the agent writes or changes a workflow. */
export function useStartWorkflowSession() {
  return useMutation({
    mutationFn: (v: {
      project: string;
      scope: "project" | "template";
      workflowId?: string;
      fromTemplate?: string;
      prompt: string;
    }) =>
      factoryFetch<{ session: string; conversationId: string }>(
        `/projects/${enc(v.project)}/workflow-sessions`,
        {
          method: "POST",
          body: {
            scope: v.scope === "template" ? "template" : v.project,
            workflowId: v.workflowId,
            fromTemplate: v.fromTemplate,
            prompt: v.prompt,
          },
        },
      ),
    meta: QUIET,
  });
}

/** The owner saves the draft (never the agent). */
export function useSaveWorkflowSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      project: string;
      session: string;
      id?: string;
      comment?: string;
    }) =>
      factoryFetch<{ scope: string; id: string; version: number }>(
        `/projects/${enc(v.project)}/workflow-sessions/${enc(v.session)}/save`,
        { method: "POST", body: { id: v.id, comment: v.comment } },
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["factory", "workflow-session"] }),
        qc.invalidateQueries({ queryKey: factoryKeys.workflows() }),
        qc.invalidateQueries({ queryKey: factoryKeys.workflowFamily() }),
      ]),
    meta: QUIET,
  });
}
