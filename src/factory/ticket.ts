import { useQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";

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

/** Choices of a card written before outcomes existed. */
export const DEFAULT_OUTCOMES: FactoryOutcome[] = [
  { id: "approve", label: "Valider", kind: "approve", requireComment: false },
  {
    id: "changes",
    label: "Demander des changements",
    kind: "changes",
    requireComment: true,
  },
];

export interface FactoryTicket {
  version: 1;
  issue: number;
  title: string;
  url?: string;
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
      typeof t.issue !== "number" ||
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

export function useFactoryTicket() {
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const workingDir = conversation?.workspace?.working_dir ?? null;

  return useQuery({
    queryKey: ["factory-ticket", conversationId, workingDir],
    enabled: !!conversationId && !!workingDir,
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
