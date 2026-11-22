/* eslint-disable @typescript-eslint/no-explicit-any -- node configs are validated server-side */
import { Plus, Trash2 } from "lucide-react";
import { cn } from "#/utils/utils";
import { useFactoryT } from "../i18n";
import {
  Field,
  fieldClassName,
  selectClassName,
  textActionClassName,
} from "../ui";
import { Area, Check, Num, Text, type SetConfig } from "./inspector-fields";

const MAX_OUTCOMES = 8;

/** Choices of a human step: one output port each. */
function OutcomesEditor({
  c,
  set,
  ro,
}: {
  c: any;
  set: SetConfig;
  ro: boolean;
}) {
  const t = useFactoryT();
  const outcomes: any[] = c.outcomes ?? [];
  const update = (i: number, patch: Record<string, unknown>) =>
    set({
      outcomes: outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  const kinds: [string, string][] = [
    ["approve", t("wfOutcomeApprove")],
    ["changes", t("wfOutcomeChanges")],
    ["reject", t("wfOutcomeReject")],
    ["other", t("wfOutcomeOther")],
  ];
  return (
    <div className="flex flex-col gap-2" data-testid="wf-outcomes">
      <span className="text-sm text-content">{t("wfOutcomes")}</span>
      {outcomes.map((o, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-border p-2"
        >
          <div className="flex gap-2">
            <input
              className={cn(fieldClassName, "w-28 font-mono")}
              value={o.id}
              disabled={ro}
              title={t("wfOutcomeId")}
              aria-label={t("wfOutcomeId")}
              onChange={(e) => update(i, { id: e.target.value })}
            />
            <input
              className={fieldClassName}
              value={o.label}
              disabled={ro}
              title={t("wfOutcomeLabel")}
              aria-label={t("wfOutcomeLabel")}
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={cn(selectClassName, "w-40")}
              value={o.kind}
              disabled={ro}
              aria-label={t("wfOutcomeKind")}
              onChange={(e) => update(i, { kind: e.target.value })}
            >
              {kinds.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Check
              label={t("wfOutcomeRequireComment")}
              checked={!!o.requireComment}
              disabled={ro}
              onChange={(requireComment) => update(i, { requireComment })}
            />
            {!ro && outcomes.length > 1 && (
              <button
                type="button"
                className={cn(
                  textActionClassName,
                  "ml-auto inline-flex items-center gap-1 text-danger",
                )}
                onClick={() =>
                  set({ outcomes: outcomes.filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("wfDelete")}
              </button>
            )}
          </div>
        </div>
      ))}
      {!ro && outcomes.length < MAX_OUTCOMES && (
        <button
          type="button"
          className={cn(
            textActionClassName,
            "inline-flex items-center gap-1 self-start",
          )}
          onClick={() =>
            set({
              outcomes: [
                ...outcomes,
                {
                  id: `choice_${outcomes.length + 1}`,
                  label: t("wfNewOutcome"),
                  kind: "other",
                  requireComment: false,
                },
              ],
            })
          }
        >
          <Plus className="size-3.5" aria-hidden />
          {t("wfAddOutcome")}
        </button>
      )}
    </div>
  );
}

/** Human step: what to validate, files to review, choices, quorum. */
export function HumanForm({
  c,
  set,
  ro,
}: {
  c: any;
  set: SetConfig;
  ro: boolean;
}) {
  const t = useFactoryT();
  return (
    <>
      <Field label={t("wfHumanTitle")}>
        <Text
          value={c.title}
          disabled={ro}
          onChange={(title) => set({ title })}
        />
      </Field>
      <Field label={t("wfHumanWhat")} hint={t("wfHumanWhatHint")}>
        <Text value={c.what} disabled={ro} onChange={(what) => set({ what })} />
      </Field>
      <Field label={t("wfHumanFiles")}>
        <Area
          value={(c.files ?? []).join("\n")}
          rows={3}
          disabled={ro}
          onChange={(v) =>
            set({
              files: v
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
      <Field label={t("wfHumanInstructions")}>
        <Area
          value={c.instructions}
          rows={3}
          disabled={ro}
          onChange={(v) => set({ instructions: v || undefined })}
        />
      </Field>
      <OutcomesEditor c={c} set={set} ro={ro} />
      <Field label={t("wfHumanQuorum")}>
        <Num
          value={c.quorum ?? 1}
          min={1}
          max={5}
          disabled={ro}
          onChange={(quorum) => set({ quorum: quorum ?? 1 })}
        />
      </Field>
      <Check
        label={t("wfHumanPostFiles")}
        checked={c.postFilesToIssue !== false}
        disabled={ro}
        onChange={(postFilesToIssue) => set({ postFilesToIssue })}
      />
    </>
  );
}
