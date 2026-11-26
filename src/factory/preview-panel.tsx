/**
 * Factory fork: the ticket's dev stack (running in the agent pod) in the browser
 * panel, at the project's preview URL (deploy.preview, served by the agent image's
 * preview proxy behind Authelia), so the owner runs the manual test beside the chat.
 */
import React from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { cn } from "#/utils/utils";
import { useProjects } from "./api";
import { useFactoryT } from "./i18n";
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

export function FactoryPreviewPanel({ url }: { url: string }) {
  const t = useFactoryT();
  const [path, setPath] = React.useState("/");
  const [src, setSrc] = React.useState(() => previewHref(url, "/"));
  const [nonce, setNonce] = React.useState(0);
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col"
      data-testid="factory-preview"
    >
      <form
        className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          setSrc(previewHref(url, path));
          setNonce((n) => n + 1);
        }}
      >
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-interactive-hover hover:text-content"
          onClick={() => setNonce((n) => n + 1)}
          aria-label={t("previewReload")}
          title={t("previewReload")}
        >
          <RotateCw className="size-4" aria-hidden />
        </button>
        <span className="shrink-0 text-xs text-muted">{new URL(url).host}</span>
        <input
          className={cn(
            "min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-0.5 font-mono text-xs text-content",
          )}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          aria-label={t("previewPath")}
          data-testid="factory-preview-path"
        />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-muted hover:bg-interactive-hover hover:text-content"
          aria-label={t("previewOpen")}
          title={t("previewOpen")}
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </form>
      <p className="shrink-0 px-3 py-1 text-xs text-muted">
        {t("previewHint")}
      </p>
      <iframe
        key={`${src}#${nonce}`}
        src={src}
        title={t("previewTitle")}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        allow="clipboard-read; clipboard-write; fullscreen"
        data-testid="factory-preview-frame"
      />
    </div>
  );
}
