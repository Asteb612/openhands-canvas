/**
 * Factory fork: the project's preview URL (deploy.preview: the dev stack running in the
 * agent pod, served by the agent image's preview proxy behind Authelia), opened in a
 * real browser tab for the owner's manual tests.
 */
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useProjects } from "./api";
import { useConversationRun } from "./run-status";

/** The preview of the conversation's factory project, if it has one. */
export function useFactoryPreview(): { url: string } | null {
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const { data } = useProjects();
  const project = run ? data?.find((p) => p.id === run.project) : undefined;
  return project?.preview ? { url: project.preview.url } : null;
}

/** Joins a path typed in the address bar to the preview origin (never another host). */
export function previewHref(base: string, path: string): string {
  const origin = new URL(base).origin;
  const p = path.trim() || "/";
  try {
    const u = new URL(p, origin);
    return u.origin === origin ? u.href : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}
