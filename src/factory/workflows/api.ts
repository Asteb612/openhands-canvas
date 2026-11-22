/**
 * Client of the factory orchestrator API, exposed on the Canvas host under
 * /factory-api behind Authelia (same origin: the session cookie authenticates).
 * Mutations send `X-Factory-Request: 1`, which the API requires.
 * Definitions are validated server-side whatever this UI sends.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const FACTORY_API = "/factory-api";

// ------------------------------------------------------------------- types

export type NodeType =
  | "trigger"
  | "agent"
  | "check"
  | "command"
  | "human"
  | "router"
  | "git"
  | "wait"
  | "note"
  | "end";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label?: string;
  maxVisits?: number;
  board?: string;
  timeoutMinutes?: number;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  port: string;
  to: string;
}

export interface WorkflowDefinition {
  schema: 1;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: {
    onExisting: "ignore" | "restart";
    cancelOnLabelRemoved: boolean;
    cancelOnIssueClosed: boolean;
    speckit: boolean;
  };
  layout: Record<string, { x: number; y: number }>;
}

export interface WorkflowSummary {
  id: string;
  /** Built-in whose latest version was written by the owner (GET /workflows/:id only). */
  customised?: boolean;
  name: string;
  description: string;
  builtin: boolean;
  archived: boolean;
  latestVersion: number;
  updatedAt: string;
}

export interface WorkflowVersion {
  version: number;
  createdBy: string;
  comment: string;
  createdAt: string;
}

export interface Problem {
  node?: string;
  edge?: { from: string; port: string };
  message: string;
}

export interface ValidationResponse {
  ok: boolean;
  problems: Problem[];
  ports: Record<string, { ports: string[]; optional: string[] }>;
}

export interface CatalogEntry {
  type: NodeType;
  label: string;
  family: string;
  description: string;
}

export interface NodeTypesResponse {
  catalog: CatalogEntry[];
  templateVars: readonly string[];
  conditionFields: readonly string[];
}

export interface FactoryProject {
  id: string;
  repo: string;
  active: boolean;
  defaultWorkflow: string | null;
  enabledWorkflows: string[];
  commands: string[];
}

export interface FactoryRun {
  id: number;
  project: string;
  issue: number;
  title: string;
  state: string;
  workflow: string;
  version: number;
  node: string | null;
  prNumber: number | null;
  conversationId: string | null;
  updatedAt: string;
}

export class FactoryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problems: Problem[] = [],
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------- fetch

export async function factoryFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const res = await fetch(`${FACTORY_API}${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(method === "GET"
        ? {}
        : { "Content-Type": "application/json", "X-Factory-Request": "1" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Authelia's login page or a proxy error: not JSON.
    throw new FactoryApiError(
      res.redirected || res.status === 401
        ? "Session expirée : recharge la page pour te reconnecter."
        : `Réponse inattendue de l’orchestrateur (HTTP ${res.status}).`,
      res.status,
    );
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; problems?: Problem[] };
    throw new FactoryApiError(
      d.error ??
        (d.problems?.length
          ? `${d.problems.length} problème(s) dans le workflow`
          : `HTTP ${res.status}`),
      res.status,
      d.problems ?? [],
    );
  }
  return data as T;
}

// ------------------------------------------------------------------- hooks

const KEY = ["factory"] as const;

export function useNodeTypes() {
  return useQuery({
    queryKey: [...KEY, "node-types"],
    queryFn: () => factoryFetch<NodeTypesResponse>("/node-types"),
    staleTime: Infinity,
  });
}

export function useWorkflows(archived = false) {
  return useQuery({
    queryKey: [...KEY, "workflows", archived],
    queryFn: () =>
      factoryFetch<{ workflows: WorkflowSummary[] }>(
        `/workflows${archived ? "?archived=1" : ""}`,
      ).then((r) => r.workflows),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "workflow", id],
    enabled: !!id,
    queryFn: () =>
      factoryFetch<{
        workflow: WorkflowSummary;
        versions: WorkflowVersion[];
        definition: WorkflowDefinition;
      }>(`/workflows/${encodeURIComponent(id!)}`),
  });
}

export function useWorkflowVersion(
  id: string | undefined,
  version: number | undefined,
) {
  return useQuery({
    queryKey: [...KEY, "version", id, version],
    enabled: !!id && !!version,
    staleTime: Infinity, // versions are immutable
    retry: false,
    meta: { disableToast: true },
    queryFn: () => fetchVersion(id!, version!),
  });
}

export function useResetWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      factoryFetch<{ version: number }>(
        `/workflows/${encodeURIComponent(id)}/reset`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
  });
}

export function fetchVersion(id: string, version: number) {
  return factoryFetch<{ definition: WorkflowDefinition }>(
    `/workflows/${encodeURIComponent(id)}/versions/${version}`,
  ).then((r) => r.definition);
}

export function validateDefinition(
  definition: WorkflowDefinition,
  projectId?: string,
) {
  return factoryFetch<ValidationResponse>("/workflows/validate", {
    method: "POST",
    body: { definition, projectId },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: [...KEY, "projects"],
    queryFn: () =>
      factoryFetch<{ projects: FactoryProject[] }>("/projects").then(
        (r) => r.projects,
      ),
  });
}

export function useRuns(project?: string) {
  return useQuery({
    queryKey: [...KEY, "runs", project ?? ""],
    queryFn: () =>
      factoryFetch<{ runs: FactoryRun[] }>(
        `/runs${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      ).then((r) => r.runs),
    refetchInterval: 15_000,
    // Shown on every conversation card: stay quiet when the API is unreachable.
    retry: false,
    meta: { disableToast: true },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useSaveWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      id: string;
      definition: WorkflowDefinition;
      comment: string;
    }) =>
      factoryFetch<{ version: number }>(
        `/workflows/${encodeURIComponent(v.id)}`,
        {
          method: "PUT",
          body: { definition: v.definition, comment: v.comment },
        },
      ),
    onSuccess: invalidate,
  });
}

export function useDuplicateWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; newId: string }) =>
      factoryFetch<{ id: string; version: number }>(
        `/workflows/${encodeURIComponent(v.id)}/duplicate`,
        { method: "POST", body: { newId: v.newId } },
      ),
    onSuccess: invalidate,
  });
}

export function useArchiveWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; archived: boolean }) =>
      factoryFetch<{ ok: true }>(
        `/workflows/${encodeURIComponent(v.id)}/archive`,
        { method: "POST", body: { archived: v.archived } },
      ),
    onSuccess: invalidate,
  });
}

export function useSetProjectWorkflows() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      projectId: string;
      default: string;
      enabled: string[];
    }) =>
      factoryFetch<{ ok: true }>(
        `/projects/${encodeURIComponent(v.projectId)}/workflows`,
        { method: "PUT", body: { default: v.default, enabled: v.enabled } },
      ),
    onSuccess: invalidate,
  });
}

export function useStartRun() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { projectId: string; issue: number; workflowId: string }) =>
      factoryFetch<{ runId: number }>("/runs", { method: "POST", body: v }),
    onSuccess: invalidate,
  });
}
