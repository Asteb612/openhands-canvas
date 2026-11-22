import { useQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { factoryKeys } from "./api";
import { useConversationRun } from "./run-status";

/**
 * Factory ticket card. Written by the software-factory orchestrator at
 * `<working_dir>/.factory/ticket.json` on every state change; the Ticket tab
 * polls it. Conversations without that file are not factory tickets and get
 * no Ticket tab.
 */
export const FACTORY_TICKET_RELATIVE_PATH = ".factory/ticket.json";
const POLL_MS = 5_000;

export type FactoryStepStatus = "done" | "current" | "review" | "todo";

export interface FactoryOutcome {
  id: string;
  label: string;
  kind: "approve" | "changes" | "reject" | "other";
  requireComment: boolean;
}

export interface FactoryTicket {
  version: 1;
  /** Null for a scheduled run (no GitHub issue). */
  issue: number | null;
  kind?: "issue" | "scheduled";
  title: string;
  url?: string | null;
  repo?: string;
  branch?: string;
  state: string;
  stateLabel: string;
  steps: { key: string; label: string; status: FactoryStepStatus }[];
  pr?: { number: number; url: string; draft?: boolean } | null;
  /** Set while the factory waits for the owner's decision. */
  review?: {
    what: string;
    files: string[];
    instructions?: string;
    /** The human node's choices (one button each). Absent on old cards. */
    outcomes?: FactoryOutcome[];
  } | null;
  /** Workflow the run follows (generic engine). */
  workflow?: { id: string; version: number; name: string };
  node?: string | null;
  /** Latest note from the orchestrator (failure reason, suspension...). */
  note?: string | null;
  updatedAt: string;
}

export function parseFactoryTicket(raw: string): FactoryTicket | null {
  try {
    const t = JSON.parse(raw) as Partial<FactoryTicket>;
    if (
      t.version !== 1 ||
      (typeof t.issue !== "number" && t.issue !== null) ||
      !t.state ||
      !Array.isArray(t.steps)
    ) {
      return null;
    }
    return t as FactoryTicket;
  } catch {
    return null;
  }
}

/**
 * The ticket card of the open conversation. Only read for conversations the
 * orchestrator knows as a ticket of the active project (no polling elsewhere).
 */
export function useFactoryTicket() {
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const run = useConversationRun(conversationId ?? undefined);
  const workingDir = conversation?.workspace?.working_dir ?? null;

  return useQuery({
    queryKey: [...factoryKeys.ticket(conversationId ?? undefined), workingDir],
    enabled: !!conversationId && !!workingDir && !!run,
    refetchInterval: POLL_MS,
    retry: false,
    meta: { disableToast: true },
    queryFn: async (): Promise<FactoryTicket | null> => {
      try {
        const raw = await AgentServerConversationService.readConversationFile(
          conversationId!,
          `${workingDir}/${FACTORY_TICKET_RELATIVE_PATH}`,
        );
        return parseFactoryTicket(raw);
      } catch {
        return null; // missing file: not a factory conversation
      }
    },
  });
}
