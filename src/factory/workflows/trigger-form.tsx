/* eslint-disable @typescript-eslint/no-explicit-any -- node configs are validated server-side */
import { useDescribeCron } from "../describe";
import { useFactoryT } from "../i18n";
import { Field } from "../ui";
import { Area, Select, Text, type SetConfig } from "./inspector-fields";

const TIMEZONES = [
  "Europe/Paris",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];
const TZ_OPTIONS: [string, string][] = TIMEZONES.map((z) => [z, z]);

/** Trigger node: what starts the workflow. */
export function TriggerForm({
  c,
  set,
  ro,
}: {
  c: any;
  set: SetConfig;
  ro: boolean;
}) {
  const t = useFactoryT();
  const describeCron = useDescribeCron();
  const tr = c.trigger ?? { kind: "manual" };
  const setT = (patch: Record<string, unknown>) =>
    set({ trigger: { ...tr, ...patch } });
  const kinds: [string, string][] = [
    ["label", t("wfTrigLabelKind")],
    ["project_status", t("wfTrigProjectStatusKind")],
    ["comment_command", t("wfTrigCommentKind")],
    ["manual", t("wfTrigManualKind")],
    ["schedule", t("wfTrigScheduleKind")],
    ["cron", t("wfTrigCronKind")],
    ["chain", t("wfTrigChainKind")],
  ];
  const results: [string, string][] = [
    ["completed", t("wfResultCompleted")],
    ["failed", t("wfResultFailed")],
    ["cancelled", t("wfResultCancelled")],
    ["any", t("wfResultAny")],
  ];
  return (
    <>
      <Field label={t("wfTrigKind")}>
        <Select
          value={tr.kind}
          options={kinds}
          disabled={ro}
          onChange={(kind) => {
            const fresh: Record<string, Record<string, unknown>> = {
              label: { kind, label: "factory:ready" },
              project_status: { kind, status: "Ready" },
              comment_command: { kind, command: "run" },
              manual: { kind },
              cron: {
                kind,
                cron: "0 9 * * 1",
                timezone: "Europe/Paris",
                issueTitle: t("wfDefaultCronTitle"),
                issueBody: "",
              },
              schedule: { kind, cron: "0 8 * * 1", timezone: "Europe/Paris" },
              chain: { kind, workflowId: "speckit-full", result: "completed" },
            };
            set({ trigger: fresh[kind] });
          }}
        />
      </Field>
      {tr.kind === "label" && (
        <>
          <Field label={t("wfTrigLabel")}>
            <Text
              value={tr.label}
              disabled={ro}
              onChange={(label) => setT({ label })}
            />
          </Field>
          <Field label={t("wfTrigAndStatus")}>
            <Text
              value={tr.projectStatus}
              disabled={ro}
              onChange={(v) => setT({ projectStatus: v || undefined })}
            />
          </Field>
        </>
      )}
      {tr.kind === "project_status" && (
        <Field label={t("wfTrigStatus")}>
          <Text
            value={tr.status}
            disabled={ro}
            onChange={(status) => setT({ status })}
          />
        </Field>
      )}
      {tr.kind === "comment_command" && (
        <Field label={t("wfTrigCommand")} hint={t("wfTrigCommandHint")}>
          <Text
            value={tr.command}
            disabled={ro}
            onChange={(command) => setT({ command })}
          />
        </Field>
      )}
      {tr.kind === "schedule" && (
        <>
          <p className="text-xs text-muted">{t("wfTrigScheduleHint")}</p>
          <Field
            label={t("wfTrigCron")}
            hint={tr.cron ? describeCron(tr.cron) : t("wfTrigCronHint")}
          >
            <Text
              value={tr.cron}
              disabled={ro}
              onChange={(cron) => setT({ cron })}
            />
          </Field>
          <Field label={t("wfTrigTimezone")}>
            <Select
              value={tr.timezone}
              disabled={ro}
              options={
                TIMEZONES.includes(tr.timezone)
                  ? TZ_OPTIONS
                  : [[tr.timezone, tr.timezone], ...TZ_OPTIONS]
              }
              onChange={(timezone) => setT({ timezone })}
            />
          </Field>
        </>
      )}
      {tr.kind === "cron" && (
        <>
          <Field label={t("wfTrigCron")} hint={t("wfTrigCronHint")}>
            <Text
              value={tr.cron}
              disabled={ro}
              onChange={(cron) => setT({ cron })}
            />
          </Field>
          <Field label={t("wfTrigTimezone")}>
            <Text
              value={tr.timezone}
              disabled={ro}
              onChange={(timezone) => setT({ timezone })}
            />
          </Field>
          <Field label={t("wfTrigIssueTitle")}>
            <Text
              value={tr.issueTitle}
              disabled={ro}
              onChange={(issueTitle) => setT({ issueTitle })}
            />
          </Field>
          <Field label={t("wfTrigIssueBody")}>
            <Area
              value={tr.issueBody}
              rows={4}
              disabled={ro}
              onChange={(issueBody) => setT({ issueBody })}
            />
          </Field>
        </>
      )}
      {tr.kind === "chain" && (
        <>
          <Field label={t("wfTrigChainWorkflow")}>
            <Text
              value={tr.workflowId}
              disabled={ro}
              onChange={(workflowId) => setT({ workflowId })}
            />
          </Field>
          <Field label={t("wfTrigChainResult")}>
            <Select
              value={tr.result}
              disabled={ro}
              options={results}
              onChange={(result) => setT({ result })}
            />
          </Field>
        </>
      )}
    </>
  );
}
