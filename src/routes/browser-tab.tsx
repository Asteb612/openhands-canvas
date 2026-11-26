import React from "react";
import { BrowserPanel } from "#/components/features/browser/browser";
import {
  FactoryPreviewPanel,
  useFactoryPreview,
} from "#/factory/preview-panel"; // factory: stack preview
import { useFactoryT } from "#/factory/i18n";
import { cn } from "#/utils/utils";

const VIEWS = ["preview", "agent"] as const;

function Browser() {
  const preview = useFactoryPreview();
  const t = useFactoryT();
  const [view, setView] = React.useState<"preview" | "agent">("preview");
  if (!preview) return <BrowserPanel />;
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1 text-xs">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              "rounded px-2 py-0.5",
              view === v
                ? "bg-interactive-hover text-content"
                : "text-muted hover:text-content",
            )}
          >
            {v === "preview" ? t("previewTab") : t("previewAgentBrowser")}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {view === "preview" ? (
          <FactoryPreviewPanel url={preview.url} />
        ) : (
          <BrowserPanel />
        )}
      </div>
    </div>
  );
}

export default Browser;
