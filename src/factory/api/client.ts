/**
 * Client of the factory orchestrator API, served by the command center under
 * /factory-api behind Authelia (same origin: the session cookie authenticates).
 * Mutations send `X-Factory-Request: 1`, which the API requires. Definitions are
 * validated server-side whatever this UI sends.
 *
 * Errors: every factory query and mutation sets `meta.disableToast` (no global toast);
 * the caller reports once, with `reportFactoryError`.
 */
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import type { Problem, WorkflowScope } from "./types";

export const FACTORY_API = "/factory-api";

export class FactoryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problems: Problem[] = [],
  ) {
    super(message);
  }
}

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

/** The single way factory screens report a failure. */
export function reportFactoryError(e: unknown): void {
  displayErrorToast(e instanceof Error ? e.message : String(e));
}

/** API base of a workflow scope. */
export function scopeBase(scope: WorkflowScope): string {
  return scope.kind === "template"
    ? "/templates"
    : `/projects/${encodeURIComponent(scope.project)}/workflows`;
}

export function scopeKey(scope: WorkflowScope): string {
  return scope.kind === "template" ? "template" : `project:${scope.project}`;
}

/** Query keys: everything under ["factory"], one family per resource. */
export const factoryKeys = {
  all: ["factory"] as const,
  nodeTypes: () => ["factory", "node-types"] as const,
  workflows: (scope?: WorkflowScope) =>
    scope
      ? (["factory", "workflows", scopeKey(scope)] as const)
      : (["factory", "workflows"] as const),
  workflow: (scope: WorkflowScope, id: string | null) =>
    ["factory", "workflow", scopeKey(scope), id] as const,
  workflowFamily: () => ["factory", "workflow"] as const,
  version: (scope: WorkflowScope, id: string, version: number) =>
    ["factory", "version", scopeKey(scope), id, version] as const,
  stats: (project: string, id: string | null) =>
    ["factory", "stats", project, id] as const,
  projects: () => ["factory", "projects"] as const,
  runs: (project?: string) => ["factory", "runs", project ?? ""] as const,
  runFamily: () => ["factory", "runs"] as const,
  status: () => ["factory", "status"] as const,
  review: (runId: number | null) => ["factory", "review", runId] as const,
  ticket: (conversationId: string | undefined) =>
    ["factory", "ticket", conversationId] as const,
};

export const QUIET = { disableToast: true } as const;
