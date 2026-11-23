/**
 * Workflow sessions: a workflow written with the agent in a conversation. The agent
 * (Claude Code over ACP, no client tools) edits `.factory/workflow.json` in its
 * workspace; the orchestrator reads, validates and saves it (see orchestrator
 * src/workflow/sessions.ts). The conversation carries `factoryworkflowsession`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { factoryFetch, factoryKeys, QUIET } from "../api/client";
import type {
  Problem,
  ValidationResponse,
  WorkflowDefinition,
  WorkflowNode,
} from "../api";

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
  /** Nodes the owner edited by hand (the agent's changes to them are reverted). */
  ownerNodes: string[];
  /** Name, description and settings edited by hand. */
  ownerWorkflow: boolean;
  /** Last time agent changes to the owner's parts were reverted. */
  restored: { nodes: string[]; workflow: boolean; at: string } | null;
}

export type SessionRef = { project: string; session: string };

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
const sessionKey = (ref: SessionRef | null) => [
  "factory",
  "workflow-session",
  ref?.project,
  ref?.session,
];
const sessionPath = (ref: SessionRef) =>
  `/projects/${enc(ref.project)}/workflow-sessions/${enc(ref.session)}`;

export function useWorkflowSession(ref: SessionRef | null) {
  return useQuery({
    queryKey: sessionKey(ref),
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

/**
 * Hand edits of the owner in the Workflow tab: a node, or the name and settings. The
 * edited part becomes the owner's (the orchestrator reverts the agent's changes to
 * it) until it is handed back with `release`.
 */
export function useSessionEdits(ref: SessionRef | null) {
  const qc = useQueryClient();
  const put = (data: WorkflowSession) => qc.setQueryData(sessionKey(ref), data);
  const node = useMutation({
    mutationFn: (n: WorkflowNode) =>
      factoryFetch<WorkflowSession>(`${sessionPath(ref!)}/nodes/${enc(n.id)}`, {
        method: "PUT",
        body: { node: n },
      }),
    onSuccess: put,
    meta: QUIET,
  });
  const workflow = useMutation({
    mutationFn: (
      w: Pick<WorkflowDefinition, "name" | "description" | "settings">,
    ) =>
      factoryFetch<WorkflowSession>(`${sessionPath(ref!)}/workflow`, {
        method: "PUT",
        body: w,
      }),
    onSuccess: put,
    meta: QUIET,
  });
  const release = useMutation({
    /** A node id, or "_workflow" for the name and settings. */
    mutationFn: (part: string) =>
      factoryFetch<WorkflowSession>(`${sessionPath(ref!)}/owner/${enc(part)}`, {
        method: "DELETE",
      }),
    onSuccess: put,
    meta: QUIET,
  });
  return { node, workflow, release };
}
