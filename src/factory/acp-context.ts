/**
 * Context window fill of an ACP (Claude Code) conversation. The Agent Server counts
 * only a turn's uncached input tokens (`per_turn_token`), so the meter showed ~0%
 * for Claude; the factory's ACP relay writes the adapter's real `used` / `size`
 * to `<session cwd>/.factory/acp-context/<sessionId>.json` (factory workspaces only).
 */
import { useQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";

const POLL_MS = 10_000;

export interface AcpContextFill {
  used: number;
  size: number;
}

export function parseAcpContext(raw: string): AcpContextFill | null {
  try {
    const v = JSON.parse(raw) as Partial<AcpContextFill>;
    return typeof v.used === "number" &&
      typeof v.size === "number" &&
      v.size > 0 &&
      v.used >= 0
      ? { used: v.used, size: v.size }
      : null;
  } catch {
    return null;
  }
}

export function useAcpContextFill(
  conversation:
    | {
        id?: string;
        conversation_url?: string | null;
        session_api_key?: string | null;
        workspace?: { working_dir?: string | null } | null;
      }
    | null
    | undefined,
) {
  const id = conversation?.id;
  const workingDir = conversation?.workspace?.working_dir ?? null;
  const url = conversation?.conversation_url;
  const key = conversation?.session_api_key;
  return useQuery({
    queryKey: ["factory", "acp-context", id, workingDir, url, key],
    enabled: !!id && !!workingDir,
    refetchInterval: POLL_MS,
    retry: false,
    meta: { disableToast: true },
    queryFn: async (): Promise<AcpContextFill | null> => {
      try {
        const session = await AgentServerConversationService.getAcpSession(
          id!,
          url,
          key,
        );
        if (session?.cwd !== workingDir) return null;
        const raw = await AgentServerConversationService.readConversationFile(
          id!,
          `${workingDir}/.factory/acp-context/${session!.sessionId}.json`,
        );
        return parseAcpContext(raw);
      } catch {
        return null; // not a factory workspace, or no turn yet
      }
    },
  });
}
