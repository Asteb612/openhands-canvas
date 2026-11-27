/**
 * Factory fork: the ticket's stack in the conversation's Preview tab.
 *
 * The app runs untouched in a frame: the preview Service Worker (served by the agent
 * pod's preview proxy, registered here with scope "/") sends the frame's requests to
 * the ticket's stack, and the script the proxy adds removes the /preview/... prefix
 * from the frame's address, so any router works. The frame reports its address; it
 * is kept per ticket so a reload comes back to the same screen. Other ports of the
 * stack (mail catcher...) are one select away (<ticket>/~<port>/).
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RotateCw } from "lucide-react";
import { cn } from "#/utils/utils";
import { useFactoryT } from "./i18n";
import type { FactoryPreviewUrls } from "./preview-panel";

/** Same sandbox as the proxy's frame page: everything but navigating Canvas itself. */
export const PREVIEW_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

const workers = new Map<string, Promise<boolean>>();

/** Registers the preview worker once per page; false: no worker (the proxy rewrites URLs instead). */
export function registerPreviewWorker(swUrl: string): Promise<boolean> {
  let p = workers.get(swUrl);
  if (!p) {
    p =
      typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? navigator.serviceWorker
            .register(swUrl, { scope: "/" })
            .then(() => navigator.serviceWorker.ready)
            .then(() => true)
            .catch(() => false)
        : Promise.resolve(false);
    workers.set(swUrl, p);
  }
  return p;
}

/** The frame address of a service: the app (null) or another port, at a path. */
export function previewSrc(
  base: string,
  port: number | null,
  path: string,
): string {
  const root = port ? `${base}~${port}/` : base;
  const p = path.trim().replace(/^\/+/, "");
  return root + p;
}

interface PreviewPorts {
  app: number;
  ports: { port: number; service: string }[];
}

function storageKey(base: string) {
  return `factory.preview.path.${base}`;
}

function readPath(base: string): string {
  try {
    return localStorage.getItem(storageKey(base)) ?? "/";
  } catch {
    return "/";
  }
}

export function FactoryPreviewFrame({
  preview,
}: {
  preview: FactoryPreviewUrls;
}) {
  const t = useFactoryT();
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = React.useState(false);
  const [port, setPort] = React.useState<number | null>(null);
  const [path, setPath] = React.useState(() => readPath(preview.url));
  const [typed, setTyped] = React.useState(path);
  // The frame's src changes only on purpose (service, typed path, reload): its own
  // navigation is reported, not driven from here.
  const [src, setSrc] = React.useState(() =>
    previewSrc(preview.url, null, path),
  );
  const [nonce, setNonce] = React.useState(0);
  const { data: ports } = useQuery({
    queryKey: ["factory", "preview-ports", preview.ports],
    queryFn: async (): Promise<PreviewPorts> => {
      const r = await fetch(preview.ports, { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    refetchInterval: 30_000,
  });

  React.useEffect(() => {
    let live = true;
    registerPreviewWorker(preview.sw).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [preview.sw]);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; path?: unknown } | null;
      if (e.source !== frame.current?.contentWindow) return;
      if (d?.type !== "factory-preview:path" || typeof d.path !== "string")
        return;
      setPath(d.path);
      setTyped(d.path);
      if (port === null) {
        try {
          localStorage.setItem(storageKey(preview.url), d.path);
        } catch {
          // private mode: not kept
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [preview.url, port]);

  const go = (nextPort: number | null, nextPath: string) => {
    setPort(nextPort);
    setSrc(previewSrc(preview.url, nextPort, nextPath));
    setNonce((n) => n + 1);
  };

  // A full-page navigation to "/x" (location.href) loads a Canvas page in the frame:
  // back into the preview, at that path.
  const onLoad = () => {
    try {
      const w = frame.current?.contentWindow as
        (Window & { __FACTORY_PREVIEW_FRAME__?: string }) | null;
      if (!w || w.__FACTORY_PREVIEW_FRAME__) return;
      const l = w.location;
      if (l.pathname.startsWith("/preview/") || l.href === "about:blank")
        return;
      go(port, l.pathname + l.search + l.hash);
    } catch {
      // not readable: leave it
    }
  };

  const services = ports?.ports ?? [];
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col"
      data-testid="factory-preview"
    >
      <form
        className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          go(port, typed);
        }}
      >
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-interactive-hover hover:text-content"
          onClick={() => go(port, path)}
          aria-label={t("previewReload")}
          title={t("previewReload")}
          data-testid="factory-preview-reload"
        >
          <RotateCw className="size-4" aria-hidden />
        </button>
        {services.length > 0 && (
          <select
            className="shrink-0 rounded border border-border bg-transparent px-1 py-0.5 text-xs text-content"
            value={port ?? ""}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : null;
              go(next, next === null ? readPath(preview.url) : "/");
            }}
            aria-label={t("previewService")}
            data-testid="factory-preview-service"
          >
            <option value="">{t("previewApp")}</option>
            {services.map((s) => (
              <option key={s.port} value={s.port}>
                {s.service ? `${s.service} (${s.port})` : `:${s.port}`}
              </option>
            ))}
          </select>
        )}
        <input
          className={cn(
            "min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-0.5 font-mono text-xs text-content",
          )}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label={t("previewPath")}
          data-testid="factory-preview-path"
        />
        <a
          href={previewSrc(preview.url, port, path)}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-muted hover:bg-interactive-hover hover:text-content"
          aria-label={t("previewOpen")}
          title={t("previewOpen")}
          data-testid="factory-preview-open"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </form>
      {ready ? (
        <iframe
          key={`${src}#${nonce}`}
          ref={frame}
          src={src}
          title={t("previewTitle")}
          data-factory-preview=""
          sandbox={PREVIEW_SANDBOX}
          allow="clipboard-read; clipboard-write; fullscreen"
          className="min-h-0 w-full flex-1 border-0 bg-white"
          onLoad={onLoad}
          data-testid="factory-preview-frame"
        />
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
