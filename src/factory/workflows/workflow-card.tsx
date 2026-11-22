/** A workflow as a card, in the automations look: name, trigger, activity, last run. */
import { CalendarClock, Play, RefreshCw, Tag } from "lucide-react";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { automationIconActionButtonClassName } from "#/components/features/automations/automation-action-button-classes";
import type { WorkflowSummary } from "../api";
import { useDescribeTrigger, useFormatDateTime } from "../describe";
import { activityLine, formatDuration, since } from "../format";
import { useFactoryT } from "../i18n";
import { RunStateChip } from "../run-status";
import {
  CardDescription,
  CardHeader,
  CardPill,
  FactoryCard,
  Pill,
  StatusStrip,
} from "../ui";

export function WorkflowCard({
  w,
  enabled,
  isDefault,
  onOpen,
  onRunNow,
  running,
}: {
  w: WorkflowSummary;
  /** Project workflows: enabled for the project (null for templates). */
  enabled: boolean | null;
  isDefault?: boolean;
  onOpen: () => void;
  /** Scheduled and enabled: start a run now. */
  onRunNow?: () => void;
  running?: boolean;
}) {
  const t = useFactoryT();
  const describe = useDescribeTrigger();
  const fmt = useFormatDateTime();
  const a = w.activity;
  const triggers = w.triggers ?? [];
  return (
    <FactoryCard onOpen={onOpen} testId={`wf-card-${w.id}`}>
      <header className="flex flex-col gap-1.5">
        <CardHeader
          title={w.name}
          badges={
            <>
              {enabled === false && <Pill>{t("disabled")}</Pill>}
              {isDefault && <Pill tone="info">{t("defaultCol")}</Pill>}
              {w.archived && <Pill>{t("wfArchivedTag")}</Pill>}
              {w.customised && <Pill tone="warning">{t("modified")}</Pill>}
              {w.templateUpdate && (
                <RefreshCw
                  className="size-3.5 shrink-0 text-info"
                  aria-label={t("wfUpdateAvailable")}
                />
              )}
            </>
          }
          actions={
            onRunNow ? (
              <StyledTooltip content={t("runNow")} placement="top">
                <button
                  type="button"
                  data-testid={`wf-run-now-${w.id}`}
                  aria-label={t("runNow")}
                  aria-busy={running}
                  disabled={running}
                  onClick={onRunNow}
                  className={automationIconActionButtonClassName}
                >
                  <Play className="size-4 shrink-0" aria-hidden />
                </button>
              </StyledTooltip>
            ) : null
          }
        />
        {w.description && <CardDescription>{w.description}</CardDescription>}
      </header>
      {(triggers.length > 0 || (a && a.runs > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {triggers.map((tr, i) => (
            <CardPill
              key={i}
              icon={
                tr.kind === "schedule" || tr.kind === "cron" ? (
                  <CalendarClock className="size-3" aria-hidden />
                ) : (
                  <Tag className="size-3" aria-hidden />
                )
              }
            >
              {describe(tr)}
            </CardPill>
          ))}
          {a && a.runs > 0 && <CardPill>{activityLine(t, a)}</CardPill>}
        </div>
      )}
      {(enabled !== null || w.scheduled) && (
        <StatusStrip>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {a?.last ? (
              <>
                <RunStateChip state={a.last.state} />
                <span className="truncate text-text-secondary">
                  {t("lastRun", {
                    when: since(t, a.last.at),
                    d: formatDuration(t, a.last.seconds),
                  })}
                </span>
              </>
            ) : (
              <span className="truncate text-text-secondary">
                {t("noRunsYet")}
              </span>
            )}
          </div>
          {w.scheduled && w.nextRunAt && enabled !== false && (
            <span className="shrink-0 text-text-secondary">
              {t("nextRun", { when: fmt(w.nextRunAt) })}
            </span>
          )}
        </StatusStrip>
      )}
    </FactoryCard>
  );
}
