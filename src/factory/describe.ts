/** Human wording of triggers and runs, shared by cards, rows and detail pages. */
import React from "react";
import { useTranslation } from "react-i18next";
import { describeSchedule } from "#/utils/automation-trigger-description";
import type { FactoryRun, TriggerSummary } from "./api";
import { useFactoryLocale, useFactoryT } from "./i18n";

/** "Every Monday at 08:00" (Canvas' own schedule wording), else the raw cron. */
export function useDescribeCron() {
  const { t } = useTranslation("openhands");
  const locale = useFactoryLocale();
  return React.useCallback(
    (cron: string) =>
      describeSchedule({ type: "cron", schedule: cron }, t, locale) ?? cron,
    [t, locale],
  );
}

/** One line per trigger: "Label factory:ready", "Every Monday at 08:00 (Europe/Paris)"... */
export function useDescribeTrigger() {
  const t = useFactoryT();
  const cron = useDescribeCron();
  return React.useCallback(
    (tr: TriggerSummary): string => {
      switch (tr.kind) {
        case "label":
          return t("trgLabel", { label: tr.label });
        case "project_status":
          return t("trgProjectStatus", { status: tr.status });
        case "comment_command":
          return t("trgCommand", { command: tr.command });
        case "manual":
          return t("trgManual");
        case "cron":
          return t("trgCronIssue", { when: cron(tr.cron) });
        case "schedule":
          return t("trgSchedule", { when: cron(tr.cron), tz: tr.timezone });
        case "chain":
          return t("trgChain", { wf: tr.workflowId });
      }
    },
    [t, cron],
  );
}

/** Date and time in the UI locale ("lun. 23 nov., 08:00"). */
export function useFormatDateTime() {
  const locale = useFactoryLocale();
  return React.useCallback(
    (iso: string | null | undefined) =>
      iso
        ? new Date(iso).toLocaleString(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    [locale],
  );
}

export function isScheduledRun(
  run: Pick<FactoryRun, "kind" | "issue">,
): boolean {
  return run.kind === "scheduled" || run.issue === null;
}

/** "#12" for an issue's run; "⏱ <date>" for a scheduled run (its workflow names it). */
export function useRunSubject() {
  const fmt = useFormatDateTime();
  return React.useCallback(
    (run: Pick<FactoryRun, "kind" | "issue" | "createdAt">) =>
      isScheduledRun(run) ? `⏱ ${fmt(run.createdAt)}` : `#${run.issue}`,
    [fmt],
  );
}
