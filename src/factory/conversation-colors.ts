/**
 * Factory fork: colour in the conversations. The owner's messages, the agent's
 * answers and each tool call (by ACP tool kind) get their own hue; the rules are
 * in conversation-colors.css, keyed by data attributes set on the rows.
 */
import "./conversation-colors.css";

/** data-factory-author of a chat message (the planning agent keeps its own frame). */
export function messageAuthor(
  type: string,
  fromPlanningAgent: boolean,
): "user" | "agent" | undefined {
  if (type === "user") return "user";
  if (type === "agent" && !fromPlanningAgent) return "agent";
  return undefined;
}

/** The ACP tool kind of an event, or of the action an observation answers. */
export function eventToolKind(...events: unknown[]): string | undefined {
  for (const e of events) {
    const kind = (e as { tool_kind?: unknown } | null | undefined)?.tool_kind;
    if (typeof kind === "string" && kind) return kind;
  }
  return undefined;
}
