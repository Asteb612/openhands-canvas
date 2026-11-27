import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { factoryFetch, factoryKeys, QUIET } from "./client";
import type {
  FactoryProject,
  FactoryStatus,
  ProjectDocker,
  ProjectSettings,
} from "./types";

const enc = encodeURIComponent;

/** Every project the orchestrator knows (running, inactive or in error). Quiet: shown everywhere. */
export function useProjects() {
  return useQuery({
    queryKey: factoryKeys.projects(),
    queryFn: () =>
      factoryFetch<{ projects: FactoryProject[] }>("/projects").then(
        (r) => r.projects,
      ),
    retry: false,
    staleTime: 30_000,
    meta: QUIET,
  });
}

export function useFactoryStatus() {
  return useQuery({
    queryKey: factoryKeys.status(),
    queryFn: () => factoryFetch<FactoryStatus>("/status"),
    refetchInterval: 30_000,
    retry: false,
    meta: QUIET,
  });
}

function useInvalidateProjects() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: factoryKeys.projects() }),
      qc.invalidateQueries({ queryKey: factoryKeys.status() }),
    ]);
}

export function useSetProjectWorkflows() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (v: {
      projectId: string;
      default: string;
      enabled: string[];
    }) =>
      factoryFetch<{ ok: true }>(`/projects/${enc(v.projectId)}/workflows`, {
        method: "PUT",
        body: { default: v.default, enabled: v.enabled },
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

export function useSaveProjectSettings() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (v: { projectId: string; settings: ProjectSettings }) =>
      factoryFetch<{ ok: true; settings: ProjectSettings }>(
        `/projects/${enc(v.projectId)}/settings`,
        { method: "PUT", body: { settings: v.settings } },
      ),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

export function useSetProjectPause() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (v: { projectId: string; paused: boolean; reason?: string }) =>
      factoryFetch<{ ok: true }>(`/projects/${enc(v.projectId)}/pause`, {
        method: "PUT",
        body: { paused: v.paused, reason: v.reason ?? "" },
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

/** Global pause of the whole factory. */
export function useSetControl() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (v: { paused: boolean; reason?: string }) =>
      factoryFetch<{ control: FactoryStatus["control"] }>("/control", {
        method: "PUT",
        body: v,
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

/** Docker resources of the project's agent pod (usage refreshed every 15 s). */
export function useProjectDocker(projectId: string, enabled = true) {
  return useQuery({
    queryKey: factoryKeys.docker(projectId),
    queryFn: () =>
      factoryFetch<ProjectDocker>(`/projects/${enc(projectId)}/docker`),
    enabled,
    retry: false,
    refetchInterval: 15_000,
    meta: QUIET,
  });
}

/** Sidecar memory (applied live) and default container limit; null = back to default. */
export function useSetProjectDocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      projectId: string;
      sidecarMemory?: string | null;
      containerMemory?: string | null;
    }) => {
      const { projectId, ...body } = v;
      return factoryFetch<{ ok: true; docker: ProjectDocker }>(
        `/projects/${enc(projectId)}/docker`,
        { method: "PUT", body },
      );
    },
    onSuccess: (r, v) => {
      qc.setQueryData(factoryKeys.docker(v.projectId), r.docker);
    },
    meta: QUIET,
  });
}
