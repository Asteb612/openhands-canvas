/**
 * Claude-Mem of the active project's agent pod (orchestrator `/api/projects/:p/memory`,
 * which talks to the plugin's worker through the project's Agent Server).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { factoryFetch, factoryKeys, QUIET } from "./client";

const enc = encodeURIComponent;

export interface MemSettings {
  observerEnabled: boolean;
  model: string;
  contextObservations: number;
  skipSubagentObservations: boolean;
  redact: boolean;
}

export type MemOverview =
  | {
      available: false;
      reason: string;
      plugin: { installed: boolean; enabled: boolean };
    }
  | {
      available: true;
      plugin: { installed: boolean; enabled: boolean };
      worker: { version: string; uptimeSeconds: number };
      stats: {
        observations: number;
        sessions: number;
        summaries: number;
        dbBytes: number;
        firstObservationAt: string | null;
      };
      processing: { active: boolean; queueDepth: number };
      settings: MemSettings;
      compliance: {
        provider: string;
        authMethod: string;
        fallbackProvider: string;
        ok: boolean;
      };
      projects: string[];
    };

export interface MemObservation {
  id: number;
  project: string;
  type: string;
  title: string;
  subtitle: string;
  narrative: string;
  facts: string[];
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
  createdAt: string;
}

export const memoryKeys = {
  all: (project: string) => [...factoryKeys.all, "memory", project] as const,
  overview: (project: string) =>
    [...factoryKeys.all, "memory", project, "overview"] as const,
  list: (
    project: string,
    q: { project: string; query: string; page: number },
  ) => [...factoryKeys.all, "memory", project, "list", q] as const,
};

export function useMemoryOverview(project: string) {
  return useQuery({
    queryKey: memoryKeys.overview(project),
    queryFn: () =>
      factoryFetch<MemOverview>(`/projects/${enc(project)}/memory`),
    enabled: !!project,
    retry: false,
    refetchInterval: 30_000,
    meta: QUIET,
  });
}

export const MEMORY_PAGE_SIZE = 30;

export function useMemoryObservations(
  project: string,
  q: { project: string; query: string; page: number },
) {
  return useQuery({
    queryKey: memoryKeys.list(project, q),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(MEMORY_PAGE_SIZE),
        offset: String(q.page * MEMORY_PAGE_SIZE),
      });
      if (q.project) params.set("project", q.project);
      if (q.query) params.set("q", q.query);
      return factoryFetch<{ items: MemObservation[]; hasMore: boolean }>(
        `/projects/${enc(project)}/memory/observations?${params}`,
      );
    },
    enabled: !!project,
    retry: false,
    placeholderData: (prev) => prev,
    meta: QUIET,
  });
}

function useInvalidateMemory(project: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: memoryKeys.all(project) });
}

export function useDeleteObservation(project: string) {
  const invalidate = useInvalidateMemory(project);
  return useMutation({
    mutationFn: (id: number) =>
      factoryFetch<{ ok: true }>(
        `/projects/${enc(project)}/memory/observations/${id}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

export function useSaveMemorySettings(project: string) {
  const invalidate = useInvalidateMemory(project);
  return useMutation({
    mutationFn: (patch: Partial<MemSettings>) =>
      factoryFetch<MemOverview>(`/projects/${enc(project)}/memory/settings`, {
        method: "PUT",
        body: patch,
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

export function useSetMemoryPlugin(project: string) {
  const invalidate = useInvalidateMemory(project);
  return useMutation({
    mutationFn: (enabled: boolean) =>
      factoryFetch<{ plugin: { installed: boolean; enabled: boolean } }>(
        `/projects/${enc(project)}/memory/plugin`,
        { method: "PUT", body: { enabled } },
      ),
    onSuccess: invalidate,
    meta: QUIET,
  });
}
