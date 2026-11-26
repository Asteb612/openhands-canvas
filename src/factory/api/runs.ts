import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { factoryFetch, factoryKeys, QUIET } from "./client";
import type { FactoryRun, ReviewData } from "./types";

/** Runs (most recent first), polled; quiet: also used by every conversation card. */
export function useRuns(project?: string) {
  return useQuery({
    queryKey: factoryKeys.runs(project),
    queryFn: () =>
      factoryFetch<{ runs: FactoryRun[] }>(
        `/runs${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      ).then((r) => r.runs),
    refetchInterval: 15_000,
    retry: false,
    meta: QUIET,
  });
}

function useInvalidateRuns() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: factoryKeys.runFamily() }),
      qc.invalidateQueries({ queryKey: factoryKeys.status() }),
    ]);
}

export function useStartRun() {
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (v: { projectId: string; issue: number; workflowId: string }) =>
      factoryFetch<{ runId: number }>("/runs", { method: "POST", body: v }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

/** New task typed in Canvas: the orchestrator creates the GitHub issue and starts the workflow. */
export function useCreateTicket() {
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (v: {
      projectId: string;
      title: string;
      body: string;
      workflowId: string;
    }) =>
      factoryFetch<{ issue: number; runId: number }>("/tickets", {
        method: "POST",
        body: v,
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}

export function useReview(runId: number | null) {
  return useQuery({
    queryKey: factoryKeys.review(runId),
    queryFn: () => factoryFetch<ReviewData>(`/runs/${runId}/review`),
    enabled: runId !== null,
    retry: false,
    refetchOnWindowFocus: false,
    meta: QUIET,
  });
}

export function useDecide() {
  const qc = useQueryClient();
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (v: { runId: number; outcome: string; comment: string }) =>
      factoryFetch<{ ok: true; via: string }>(`/runs/${v.runId}/decide`, {
        method: "POST",
        body: { outcome: v.outcome, comment: v.comment },
      }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: factoryKeys.review(v.runId) });
      return invalidate();
    },
    meta: QUIET,
  });
}

/** Resume a FAILED run at a node of its pinned workflow (same branch, workspace, conversation). */
export function useResumeRun() {
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (v: { runId: number; node: string; comment: string }) =>
      factoryFetch<{
        ok: true;
        run: { id: number; state: string; node: string };
        warning?: string;
      }>(`/runs/${v.runId}/resume`, {
        method: "POST",
        body: { node: v.node, comment: v.comment },
      }),
    onSuccess: invalidate,
    meta: QUIET,
  });
}
