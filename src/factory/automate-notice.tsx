/**
 * Shown on Canvas' Automate page when the factory runs: with Claude Code (ACP, the
 * Claude subscription) the agent gets no client tools, so it cannot fill Automate's
 * form. Recurring tasks are scheduled factory workflows, written with the agent in a
 * conversation instead. Dismissible (per browser).
 */
import React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { Link } from "react-router";
import { CalendarClock, Sparkles, X } from "lucide-react";
import { useFactoryT } from "./i18n";
import { useSelectedProject } from "./project-context";
import { textActionClassName } from "./ui";

const STORAGE_KEY = "factory-automate-notice-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Nothing outside a query client (Automate's own tests render the page bare). */
export function FactoryAutomateNotice() {
  return React.useContext(QueryClientContext) ? <AutomateNotice /> : null;
}

function AutomateNotice() {
  const t = useFactoryT();
  const { projects, projectId } = useSelectedProject();
  const [dismissed, setDismissed] = React.useState(readDismissed);
  if (dismissed || projects.length === 0) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Not remembered: shown again next time.
    }
  };
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-base-secondary p-4"
      data-testid="factory-automate-notice"
    >
      <CalendarClock
        className="mt-0.5 size-5 shrink-0 text-muted"
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-content">
          {t("automateNoticeTitle")}
        </p>
        <p className="text-sm text-muted">{t("automateNoticeBody")}</p>
        <div className="flex flex-wrap items-center gap-4">
          {projectId && (
            <Link
              to="/factory/workflows?agent=1"
              className={`${textActionClassName} inline-flex items-center gap-1`}
              data-testid="factory-automate-notice-agent"
            >
              <Sparkles className="size-3.5" aria-hidden />
              {t("agentCreate")}
            </Link>
          )}
          <Link to="/factory/workflows" className={textActionClassName}>
            {t("automateNoticeWorkflows")}
          </Link>
        </div>
      </div>
      <button
        type="button"
        aria-label={t("close")}
        className="cursor-pointer text-muted hover:text-content"
        onClick={dismiss}
        data-testid="factory-automate-notice-dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
