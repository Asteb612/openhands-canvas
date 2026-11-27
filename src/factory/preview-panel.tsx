/**
 * Factory fork: the ticket's dev stack preview (deploy.preview) for the owner's manual
 * tests: <command center>/preview/<project>/<ticket>/, served by the agent image's
 * preview proxy behind Authelia, shown in the conversation's Preview tab
 * (preview-frame.tsx) or in a browser tab. Each ticket's stack runs side by side with
 * the others; <project preview>/ lists them.
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
export interface FactoryPreviewUrls {
  /** The ticket's app: <project preview>/<ticket>/. */
  url: string;
  /** All stacks of the project. */
  index: string;
  /** The preview Service Worker (served by the agent pod's preview proxy). */
  sw: string;
  /** JSON: the other ports the ticket's stack publishes. */
  ports: string;
}

export function previewUrls(
  projectBase: string,
  run: { id: number; issue: number | null },
): FactoryPreviewUrls {
  const index = projectBase.endsWith("/") ? projectBase : `${projectBase}/`;
  const key = previewTicketKey(run);
  return {
    url: `${index}${key}/`,
    index,
    sw: `${index}~sw.js`,
    ports: `${index}~ports/${key}`,
  };
}

export function useFactoryPreview(): FactoryPreviewUrls | null {
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const { data } = useProjects();
  const project = run ? data?.find((p) => p.id === run.project) : undefined;
  return run && project?.preview ? previewUrls(project.preview.url, run) : null;
}
