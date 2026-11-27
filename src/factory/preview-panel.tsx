/**
 * Factory fork: the ticket's dev stack preview (deploy.preview), opened in a real
 * browser tab for the owner's manual tests: <command center>/preview/<project>/<ticket>/,
 * served by the agent image's preview proxy behind Authelia. Each ticket's stack runs
 * side by side with the others; <project preview>/ lists them.
 */
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useProjects } from "./api";
import { useConversationRun } from "./run-status";

/** The ticket's key in the stack and preview names: the issue, or sched-<run> (orchestrator workKey). */
export function previewTicketKey(run: {
  id: number;
  issue: number | null;
}): string {
  return run.issue === null ? `sched-${run.id}` : String(run.issue);
}

/** Preview URLs of the conversation's ticket (ticket) and of its project (all stacks). */
export function previewUrls(
  projectBase: string,
  run: { id: number; issue: number | null },
): { url: string; index: string } {
  const index = projectBase.endsWith("/") ? projectBase : `${projectBase}/`;
  return { url: `${index}${previewTicketKey(run)}/`, index };
}

export function useFactoryPreview(): { url: string; index: string } | null {
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const { data } = useProjects();
  const project = run ? data?.find((p) => p.id === run.project) : undefined;
  return run && project?.preview ? previewUrls(project.preview.url, run) : null;
}
