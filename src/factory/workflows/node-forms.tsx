/* eslint-disable @typescript-eslint/no-explicit-any -- node configs are validated server-side */
import React from "react";
import type { WorkflowNode } from "../api";
import { useFactoryT } from "../i18n";
import { Field } from "../ui";
import { HumanForm } from "./human-form";
import {
  Area,
  Check,
  Num,
  Select,
  Text,
  type SetConfig,
} from "./inspector-fields";
import { TriggerForm } from "./trigger-form";

interface FormProps {
  c: any;
  set: SetConfig;
  ro: boolean;
}

const parseNames = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Project command names as a comma-separated text field. The text is kept as typed
 * (a trailing ", " survives the round trip); the config gets the parsed list.
 */
function CommandNames({
  value,
  ro,
  onChange,
  testId,
}: {
  value: string[] | undefined;
  ro: boolean;
  onChange: (v: string[]) => void;
  testId?: string;
}) {
  const joined = (value ?? []).join(", ");
  const [text, setText] = React.useState(joined);
  // Another node selected, or an outside change (undo, agent draft): show the config.
  if (parseNames(text).join(", ") !== joined) setText(joined);
  return (
    <Text
      value={text}
      disabled={ro}
      testId={testId}
      onChange={(v) => {
        setText(v);
        onChange(parseNames(v));
      }}
    />
  );
}

const REVIEW_FOCUS = [
  "correctness",
  "security",
  "tests",
  "conventions",
] as const;

/** Claude Code reasoning effort of an agent or review step (orchestrator EFFORT_LEVELS). */
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

function EffortField({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  return (
    <Field label={t("wfEffort")} hint={t("wfEffortHint")}>
      <Select
        value={c.effort ?? "default"}
        disabled={ro}
        testId="wf-effort"
        options={[
          ["default", t("wfEffortDefault")],
          ...EFFORT_LEVELS.map((e): [string, string] => [e, e]),
        ]}
        onChange={(v) => set({ effort: v === "default" ? undefined : v })}
      />
    </Field>
  );
}

function ReviewForm({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  const focus: string[] = c.focus ?? ["correctness", "security"];
  const labels: Record<(typeof REVIEW_FOCUS)[number], string> = {
    correctness: t("wfReviewCorrectness"),
    security: t("wfReviewSecurity"),
    tests: t("wfReviewTests"),
    conventions: t("wfReviewConventions"),
  };
  return (
    <>
      <p className="text-xs text-muted">{t("wfReviewIntro")}</p>
      <Field label={t("wfReviewFocus")}>
        <div className="flex flex-col gap-2" data-testid="wf-review-focus">
          {REVIEW_FOCUS.map((f) => (
            <Check
              key={f}
              label={labels[f]}
              checked={focus.includes(f)}
              disabled={ro || (focus.length === 1 && focus.includes(f))}
              onChange={(on) =>
                set({
                  focus: on
                    ? REVIEW_FOCUS.filter((x) => x === f || focus.includes(x))
                    : focus.filter((x) => x !== f),
                })
              }
            />
          ))}
        </div>
      </Field>
      <Field label={t("wfReviewBlockOn")}>
        <Select
          value={c.blockOn ?? "important"}
          disabled={ro}
          options={[
            ["important", t("wfReviewBlockImportant")],
            ["any", t("wfReviewBlockAny")],
          ]}
          onChange={(blockOn) => set({ blockOn })}
        />
      </Field>
      <EffortField c={c} set={set} ro={ro} />
      <Field
        label={t("wfReviewInstructions")}
        hint={t("wfReviewInstructionsHint")}
      >
        <Area
          value={c.instructions}
          rows={4}
          disabled={ro}
          onChange={(v) => set({ instructions: v || undefined })}
        />
      </Field>
    </>
  );
}

function AgentForm({
  c,
  set,
  ro,
  commands,
}: FormProps & { commands: string[] }) {
  const t = useFactoryT();
  return (
    <>
      <Field label={t("wfAgentPrompt")} hint={t("wfAgentPromptHint")}>
        <Area
          value={c.prompt}
          rows={10}
          disabled={ro}
          testId="wf-agent-prompt"
          onChange={(prompt) => set({ prompt })}
        />
      </Field>
      <Field label={t("wfAgentRevisit")} hint={t("wfAgentRevisitHint")}>
        <Area
          value={c.revisitPrompt}
          rows={5}
          disabled={ro}
          onChange={(v) => set({ revisitPrompt: v || undefined })}
        />
      </Field>
      <Field label={t("conversation")}>
        <Select
          value={c.conversation ?? "ticket"}
          disabled={ro}
          options={[
            ["ticket", t("wfAgentConvTicket")],
            ["new", t("wfAgentConvNew")],
          ]}
          onChange={(conversation) => set({ conversation })}
        />
      </Field>
      <EffortField c={c} set={set} ro={ro} />
      <Field
        label={t("wfAgentStopChecks")}
        hint={t("wfAgentStopChecksHint", {
          list: commands.join(", ") || "—",
        })}
      >
        <CommandNames
          value={c.stopChecks}
          ro={ro}
          testId="wf-agent-stop-checks"
          onChange={(stopChecks) => set({ stopChecks })}
        />
      </Field>
    </>
  );
}

function CommandForm({
  c,
  set,
  ro,
  commands,
}: FormProps & { commands: string[] }) {
  const t = useFactoryT();
  return (
    <Field
      label={t("wfCommandList")}
      hint={
        commands.length
          ? t("wfCommandAvailable", { list: commands.join(", ") })
          : undefined
      }
    >
      <CommandNames
        value={c.commands}
        ro={ro}
        onChange={(v) => set({ commands: v })}
      />
    </Field>
  );
}

function GitForm({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  const actions: [string, string][] = [
    ["push", t("wfGitPush")],
    ["draft_pr", t("wfGitDraftPr")],
    ["ready_pr", t("wfGitReadyPr")],
    ["comment", t("wfGitComment")],
    ["add_label", t("wfGitAddLabel")],
    ["remove_label", t("wfGitRemoveLabel")],
  ];
  return (
    <>
      <Field label={t("wfGitAction")}>
        <Select
          value={c.action}
          options={actions}
          disabled={ro}
          onChange={(action) =>
            set({
              action,
              title: undefined,
              text: action === "comment" ? t("wfDefaultGitComment") : undefined,
              label: action.endsWith("_label") ? "factory:label" : undefined,
            })
          }
        />
      </Field>
      {c.action === "draft_pr" && (
        <Field label={t("wfGitPrTitle")}>
          <Text
            value={c.title}
            disabled={ro}
            onChange={(v) => set({ title: v || undefined })}
          />
        </Field>
      )}
      {c.action === "comment" && (
        <Field label={t("wfGitText")}>
          <Area
            value={c.text}
            rows={4}
            disabled={ro}
            onChange={(text) => set({ text })}
          />
        </Field>
      )}
      {(c.action === "add_label" || c.action === "remove_label") && (
        <Field label={t("wfTrigLabel")}>
          <Text
            value={c.label}
            disabled={ro}
            onChange={(label) => set({ label })}
          />
        </Field>
      )}
    </>
  );
}

function WaitForm({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  return (
    <>
      <Field label={t("wfWaitFor")}>
        <Select
          value={c.for}
          disabled={ro}
          options={[
            ["pr_merged", t("wfWaitPrMerged")],
            ["ci", t("wfWaitCi")],
            ["duration", t("wfWaitDuration")],
          ]}
          onChange={(f) =>
            set(
              f === "duration"
                ? { for: f, minutes: 60 }
                : { for: f, minutes: undefined },
            )
          }
        />
      </Field>
      {c.for === "duration" && (
        <Field label={t("wfWaitMinutes")}>
          <Num
            value={c.minutes}
            min={1}
            disabled={ro}
            onChange={(minutes) => set({ minutes })}
          />
        </Field>
      )}
    </>
  );
}

function NoteForm({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  return (
    <>
      <Field label={t("wfNoteText")}>
        <Area
          value={c.text}
          rows={4}
          disabled={ro}
          onChange={(text) => set({ text })}
        />
      </Field>
      <Field label={t("wfNoteTo")}>
        <Select
          value={c.to ?? "canvas"}
          disabled={ro}
          options={[
            ["canvas", t("wfNoteToCanvas")],
            ["issue", t("wfNoteToIssue")],
            ["both", t("wfNoteToBoth")],
          ]}
          onChange={(to) => set({ to })}
        />
      </Field>
    </>
  );
}

function EndForm({ c, set, ro }: FormProps) {
  const t = useFactoryT();
  return (
    <>
      <Field label={t("wfEndResult")}>
        <Select
          value={c.result}
          disabled={ro}
          options={[
            ["completed", t("wfResultCompleted")],
            ["failed", t("wfResultFailed")],
            ["cancelled", t("wfResultCancelled")],
          ]}
          onChange={(result) => set({ result })}
        />
      </Field>
      <Field label={t("wfEndMessage")}>
        <Text
          value={c.message}
          disabled={ro}
          onChange={(v) => set({ message: v || undefined })}
        />
      </Field>
    </>
  );
}

/** The form of a node's type; check and router are edited as JSON (validated server-side). */
export function TypeForm({
  node,
  set,
  ro,
  commands,
}: {
  node: WorkflowNode;
  set: SetConfig;
  ro: boolean;
  commands: string[];
}) {
  const c = node.config as any;
  const props = { c, set, ro };
  switch (node.type) {
    case "trigger":
      return <TriggerForm {...props} />;
    case "agent":
      return <AgentForm {...props} commands={commands} />;
    case "review":
      return <ReviewForm {...props} />;
    case "command":
      return <CommandForm {...props} commands={commands} />;
    case "human":
      return <HumanForm {...props} />;
    case "git":
      return <GitForm {...props} />;
    case "wait":
      return <WaitForm {...props} />;
    case "note":
      return <NoteForm {...props} />;
    case "end":
      return <EndForm {...props} />;
    default:
      return null;
  }
}
