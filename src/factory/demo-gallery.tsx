/**
 * The demo step's screenshots, GIF and video (specs/demo/ of a factory ticket),
 * listed by the markdown images of specs/demo/README.md, shown in the Ticket tab.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";
import { useFactoryT } from "./i18n";

export const DEMO_DIR = "specs/demo";
const POLL_MS = 30_000;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};

export interface DemoMedia {
  file: string;
  caption: string;
  mime: string;
}

/** `![caption](file)` images of the README, relative to specs/demo/, safe names only. */
export function parseDemoReadme(md: string): DemoMedia[] {
  const out: DemoMedia[] = [];
  const seen = new Set<string>();
  for (const m of md.matchAll(/!\[([^\]]*)\]\(<?([^)>\s]+)>?\)/g)) {
    const file = m[2].replace(/^\.\//, "");
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    if (
      !MIME[ext] ||
      file.includes("..") ||
      file.startsWith("/") ||
      /^[a-z]+:/i.test(file) ||
      seen.has(file)
    )
      continue;
    seen.add(file);
    out.push({ file, caption: m[1].trim(), mime: MIME[ext] });
  }
  return out;
}

function useDemo() {
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const workingDir = conversation?.workspace?.working_dir ?? null;
  return useQuery({
    queryKey: ["factory", "demo", conversationId, workingDir],
    enabled: !!conversationId && !!workingDir,
    refetchInterval: POLL_MS,
    retry: false,
    meta: { disableToast: true },
    queryFn: async () => {
      try {
        const readme =
          await AgentServerConversationService.readConversationFile(
            conversationId!,
            `${workingDir}/${DEMO_DIR}/README.md`,
          );
        return {
          readme,
          media: parseDemoReadme(readme),
          workingDir: workingDir!,
        };
      } catch {
        return null; // no demo yet
      }
    },
  });
}

function MediaItem({
  conversationId,
  path,
  media,
}: {
  conversationId: string;
  path: string;
  media: DemoMedia;
}) {
  const { data: url } = useQuery({
    queryKey: ["factory", "demo-file", conversationId, path, media.mime],
    staleTime: 60_000,
    retry: false,
    meta: { disableToast: true },
    queryFn: async () => {
      const buf =
        await AgentServerConversationService.readConversationBinaryFile(
          conversationId,
          path,
        );
      return URL.createObjectURL(new Blob([buf], { type: media.mime }));
    },
  });
  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <figure
      className="flex min-w-0 flex-col gap-1"
      data-testid="factory-demo-item"
    >
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-border"
        >
          {media.mime.startsWith("video/") ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} controls className="w-full" />
          ) : (
            <img
              src={url}
              alt={media.caption || media.file}
              className="w-full"
            />
          )}
        </a>
      ) : (
        <div className="aspect-video w-full animate-pulse rounded-lg bg-surface-raised" />
      )}
      <figcaption className="text-xs text-muted">
        <span className="font-mono">{media.file}</span>
        {media.caption ? ` — ${media.caption}` : ""}
      </figcaption>
    </figure>
  );
}

export function FactoryDemoGallery() {
  const t = useFactoryT();
  const { conversationId } = useOptionalConversationId();
  const { data } = useDemo();
  const [showReadme, setShowReadme] = React.useState(false);
  if (!data || !conversationId) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="factory-demo">
      <h3 className="text-sm font-medium">
        {t("demoTitle", { n: data.media.length })}
      </h3>
      {data.media.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.media.map((m) => (
            <MediaItem
              key={m.file}
              conversationId={conversationId}
              path={`${data.workingDir}/${DEMO_DIR}/${m.file}`}
              media={m}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("demoNone")}</p>
      )}
      <button
        type="button"
        className="self-start text-xs text-muted underline underline-offset-2"
        onClick={() => setShowReadme((v) => !v)}
      >
        {showReadme ? t("demoHideNotes") : t("demoShowNotes")}
      </button>
      {showReadme && (
        <div className="text-sm text-muted">
          <MarkdownRenderer includeStandard>
            {data.readme.replace(/!\[[^\]]*\]\([^)]*\)/g, "")}
          </MarkdownRenderer>
        </div>
      )}
    </section>
  );
}
