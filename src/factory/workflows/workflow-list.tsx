/** Left column: the active project's workflows and the template library, as tabs. */
import React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "#/utils/utils";
import { useWorkflows, type WorkflowScope, type WorkflowSummary } from "../api";
import { useFactoryT } from "../i18n";
import { Pill, StateMessage, Switch } from "../ui";

export type ScopeTab = "project" | "template";

function WorkflowItem({
  w,
  selected,
  onSelect,
}: {
  w: WorkflowSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useFactoryT();
  const source = w.source?.split("@")[0];
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(w.id)}
        data-testid={`wf-list-${w.id}`}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-2.5 py-2 text-left hover:bg-surface-raised",
          selected && "bg-surface-raised",
        )}
      >
        <span className="flex w-full items-center gap-1.5 text-sm text-content">
          <span className="min-w-0 flex-1 truncate">{w.name}</span>
          {w.templateUpdate && (
            <RefreshCw
              className="size-3.5 shrink-0 text-info"
              aria-label={t("wfUpdateAvailable")}
              data-testid={`wf-list-update-${w.id}`}
            />
          )}
        </span>
        <span className="font-mono text-xs text-muted">
          {t("wfIdVersion", { id: w.id, v: w.latestVersion })}
        </span>
        {(w.archived || w.builtin || w.customised || source) && (
          <span className="flex flex-wrap gap-1">
            {w.archived && <Pill>{t("wfArchivedTag")}</Pill>}
            {w.scope === "template" && w.builtin && (
              <Pill>{t("builtinTemplate")}</Pill>
            )}
            {w.customised && <Pill tone="warning">{t("modified")}</Pill>}
            {source && <Pill>{t("fromTemplate", { t: source })}</Pill>}
          </span>
        )}
      </button>
    </li>
  );
}

export function WorkflowList({
  projectName,
  tab,
  onTab,
  scope,
  selected,
  onSelect,
}: {
  /** Active project (null: templates only). */
  projectName: string | null;
  tab: ScopeTab;
  onTab: (tab: ScopeTab) => void;
  scope: WorkflowScope;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useFactoryT();
  const [showArchived, setShowArchived] = React.useState(false);
  const { data, error, isLoading } = useWorkflows(scope, showArchived);
  const tabs: [ScopeTab, string][] = projectName
    ? [
        ["project", t("projectWorkflows", { p: projectName })],
        ["template", t("templates")],
      ]
    : [["template", t("templates")]];
  return (
    <nav
      className="flex w-64 shrink-0 flex-col border-r border-border"
      data-testid="wf-list"
      aria-label={t("navWorkflows")}
    >
      <div className="flex border-b border-border" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            data-testid={`wf-tab-${k}`}
            onClick={() => onTab(k)}
            className={cn(
              "min-w-0 flex-1 cursor-pointer truncate border-b-2 px-2 py-2.5 text-sm",
              tab === k
                ? "border-primary font-medium text-content"
                : "border-transparent text-muted hover:text-content",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {!projectName && (
          <p className="px-1 text-xs text-muted">{t("wfTemplatesOnly")}</p>
        )}
        {isLoading && <StateMessage kind="loading" />}
        {error && <StateMessage kind="error">{error.message}</StateMessage>}
        {data?.length === 0 && (
          <StateMessage kind="empty">{t("wfNoWorkflows")}</StateMessage>
        )}
        {!!data?.length && (
          <ul className="flex flex-col gap-0.5">
            {data.map((w) => (
              <WorkflowItem
                key={w.id}
                w={w}
                selected={selected === w.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-3">
        <Switch
          isToggled={showArchived}
          onToggle={setShowArchived}
          testId="wf-show-archived"
        >
          {t("wfShowArchived")}
        </Switch>
      </div>
    </nav>
  );
}
