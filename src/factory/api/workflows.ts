import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { factoryFetch, factoryKeys, QUIET, scopeBase } from "./client";
import type {
  NodeTypesResponse,
  ValidationResponse,
  WorkflowDefinition,
  WorkflowScope,
  WorkflowStats,
  WorkflowSummary,
  WorkflowVersion,
} from "./types";

const enc = encodeURIComponent;

export function useNodeTypes() {
  return useQuery({
    queryKey: factoryKeys.nodeTypes(),
    queryFn: () => factoryFetch<NodeTypesResponse>("/node-types"),
    staleTime: Infinity,
    meta: QUIET,
  });
}

/** Workflows of a scope (template library or a project); null scope = disabled. */
export function useWorkflows(scope: WorkflowScope | null, archived = false) {
  return useQuery({
    queryKey: [...factoryKeys.workflows(scope ?? undefined), archived],
    queryFn: () =>
      factoryFetch<{ workflows: WorkflowSummary[] }>(
        `${scopeBase(scope!)}${archived ? "?archived=1" : ""}`,
      ).then((r) => r.workflows),
    enabled: !!scope,
    retry: false,
    meta: QUIET,
  });
}

export function useWorkflow(scope: WorkflowScope | null, id: string | null) {
  return useQuery({
    queryKey: factoryKeys.workflow(scope ?? { kind: "template" }, id),
    enabled: !!scope && !!id,
    refetchOnWindowFocus: false,
    retry: false,
    meta: QUIET,
    queryFn: () =>
      factoryFetch<{
        workflow: WorkflowSummary;
        versions: WorkflowVersion[];
        definition: WorkflowDefinition;
      }>(`${scopeBase(scope!)}/${enc(id!)}`),
  });
}

export function useWorkflowVersion(
  scope: WorkflowScope,
  id: string,
  version: number,
) {
  return useQuery({
    queryKey: factoryKeys.version(scope, id, version),
    queryFn: () => fetchVersion(scope, id, version),
    staleTime: Infinity, // versions are immutable
    retry: false,
    meta: QUIET,
  });
}

export function fetchVersion(
  scope: WorkflowScope,
  id: string,
  version: number,
): Promise<WorkflowDefinition> {
  return factoryFetch<{ definition: WorkflowDefinition }>(
    `${scopeBase(scope)}/${enc(id)}/versions/${version}`,
  ).then((r) => r.definition);
}

export function validateDefinition(
  scope: WorkflowScope,
  definition: WorkflowDefinition,
): Promise<ValidationResponse> {
  return factoryFetch<ValidationResponse>(`${scopeBase(scope)}/validate`, {
    method: "POST",
    body: { definition },
  });
}

export function useWorkflowStats(project: string | null, id: string | null) {
  return useQuery({
    queryKey: factoryKeys.stats(project ?? "", id),
    queryFn: () =>
      factoryFetch<{ stats: WorkflowStats }>(
        `/projects/${enc(project!)}/workflows/${enc(id!)}/stats`,
      ).then((r) => r.stats),
    enabled: !!project && !!id,
    retry: false,
    meta: QUIET,
  });
}

/** After a workflow change: that scope's lists and details (templates: every scope, for updates). */
function useInvalidateWorkflows() {
  const qc = useQueryClient();
  return (scope: WorkflowScope) => {
    const lists =
      scope.kind === "template"
        ? factoryKeys.workflows()
        : factoryKeys.workflows(scope);
    return Promise.all([
      qc.invalidateQueries({ queryKey: lists }),
      qc.invalidateQueries({ queryKey: factoryKeys.workflowFamily() }),
      qc.invalidateQueries({ queryKey: factoryKeys.projects() }),
    ]);
  };
}

export function useSaveWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: {
      scope: WorkflowScope;
      id: string;
      definition: WorkflowDefinition;
      comment: string;
    }) =>
      factoryFetch<{ version: number }>(`${scopeBase(v.scope)}/${enc(v.id)}`, {
        method: "PUT",
        body: { definition: v.definition, comment: v.comment },
      }),
    onSuccess: (_d, v) => invalidate(v.scope),
    meta: QUIET,
  });
}

export function useDuplicateWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: { scope: WorkflowScope; id: string; newId: string }) =>
      factoryFetch<{ id: string; version: number }>(
        `${scopeBase(v.scope)}/${enc(v.id)}/duplicate`,
        { method: "POST", body: { newId: v.newId } },
      ),
    onSuccess: (_d, v) => invalidate(v.scope),
    meta: QUIET,
  });
}

export function useArchiveWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: { scope: WorkflowScope; id: string; archived: boolean }) =>
      factoryFetch<{ ok: true }>(`${scopeBase(v.scope)}/${enc(v.id)}/archive`, {
        method: "POST",
        body: { archived: v.archived },
      }),
    onSuccess: (_d, v) => invalidate(v.scope),
    meta: QUIET,
  });
}

/** Template: back to its code version. Project workflow: take its template's latest version. */
export function useResetWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: { scope: WorkflowScope; id: string }) =>
      factoryFetch<{ version: number }>(
        `${scopeBase(v.scope)}/${enc(v.id)}/reset`,
        {
          method: "POST",
        },
      ),
    onSuccess: (_d, v) => invalidate(v.scope),
    meta: QUIET,
  });
}

/** A project's own copy of a template. */
export function useCreateFromTemplate() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: { project: string; fromTemplate: string; id: string }) =>
      factoryFetch<{ id: string; version: number }>(
        `/projects/${enc(v.project)}/workflows`,
        { method: "POST", body: { fromTemplate: v.fromTemplate, id: v.id } },
      ),
    onSuccess: (_d, v) => invalidate({ kind: "project", project: v.project }),
    meta: QUIET,
  });
}

/** Publishes a project's workflow to the template library. */
export function usePublishWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (v: { project: string; id: string; templateId: string }) =>
      factoryFetch<{ templateId: string; version: number }>(
        `/projects/${enc(v.project)}/workflows/${enc(v.id)}/publish`,
        { method: "POST", body: { templateId: v.templateId } },
      ),
    onSuccess: () => invalidate({ kind: "template" }),
    meta: QUIET,
  });
}
