import { useMemo } from "react";
import useMetricsStore from "#/stores/metrics-store";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useConversationMetrics } from "#/hooks/query/use-conversation-metrics";
import { useAcpContextFill } from "#/factory/acp-context";

export interface ContextWindowUsage {
  perTurnToken: number;
  contextWindow: number;
}

function toContextWindowUsage(
  usage:
    | {
        per_turn_token?: number | null;
        context_window?: number | null;
      }
    | null
    | undefined,
): ContextWindowUsage | null {
  const contextWindow = usage?.context_window ?? 0;
  if (contextWindow <= 0) {
    return null;
  }

  return {
    perTurnToken: usage?.per_turn_token ?? 0,
    contextWindow,
  };
}

export function useContextWindowUsage(): ContextWindowUsage | null {
  const storeUsage = useMetricsStore((state) => state.usage);
  const { data: conversation } = useActiveConversation();

  const { data: conversationMetrics } = useConversationMetrics(
    conversation?.id,
    conversation?.conversation_url,
    conversation?.session_api_key,
    Boolean(conversation?.id),
  );
  // Factory fork: the real fill of a Claude Code (ACP) session, when the relay wrote it.
  const { data: acpFill } = useAcpContextFill(conversation);

  return useMemo(() => {
    if (acpFill) {
      return { perTurnToken: acpFill.used, contextWindow: acpFill.size };
    }
    const fromStore = toContextWindowUsage(storeUsage);
    if (fromStore) {
      return fromStore;
    }

    return toContextWindowUsage(
      conversationMetrics?.accumulated_token_usage ?? null,
    );
  }, [acpFill, storeUsage, conversationMetrics]);
}
