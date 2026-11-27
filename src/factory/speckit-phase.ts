/**
 * Spec-kit phase of a factory ticket conversation: the agent image's phase hook writes
 * every change (/speckit.plan typed in the chat, the agent calling the command, a
 * workflow step) to `<working dir>/.factory/phases.jsonl`.
 */
import { useQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";

const POLL_MS = 5_000;

export const SPECKIT_PHASES = [
  "specify",
  "clarify",
  "plan",
  "tasks",
  "analyze",
  "implement",
] as const;
export type SpeckitPhase = (typeof SPECKIT_PHASES)[number];
export type PhaseStatus = "started" | "done" | "stopped";

export interface SpeckitProgress {
  /** The latest change. */
  current: { phase: SpeckitPhase; status: PhaseStatus; at: number };
  /** Last status of every phase seen. */
  phases: Partial<Record<SpeckitPhase, PhaseStatus>>;
}

export function parsePhases(raw: string): SpeckitProgress | null {
  let current: SpeckitProgress["current"] | null = null;
  const phases: SpeckitProgress["phases"] = {};
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as {
        phase?: string;
        status?: string;
        at?: number;
      };
      if (
        !SPECKIT_PHASES.includes(e.phase as SpeckitPhase) ||
        !["started", "done", "stopped"].includes(e.status ?? "") ||
        typeof e.at !== "number"
      )
        continue;
      const phase = e.phase as SpeckitPhase;
      const status = e.status as PhaseStatus;
      phases[phase] = status;
      current = { phase, status, at: e.at };
    } catch {
      // partial line
    }
  }
  return current ? { current, phases } : null;
}

export function useSpeckitProgress() {
  const { data: conversation } = useActiveConversation();
  const id = conversation?.id;
  const workingDir = conversation?.workspace?.working_dir ?? null;
  return useQuery({
    queryKey: ["factory", "speckit-phase", id, workingDir],
    enabled: !!id && !!workingDir,
    refetchInterval: POLL_MS,
    retry: false,
    meta: { disableToast: true },
    queryFn: async (): Promise<SpeckitProgress | null> => {
      try {
        const raw = await AgentServerConversationService.readConversationFile(
          id!,
          `${workingDir}/.factory/phases.jsonl`,
        );
        return parsePhases(raw);
      } catch {
        return null; // no phase yet
      }
    },
  });
}
