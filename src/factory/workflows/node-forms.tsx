/* eslint-disable @typescript-eslint/no-explicit-any -- node configs are validated server-side */
import type { WorkflowNode } from "../api";
import { useFactoryT } from "../i18n";
import { Field } from "../ui";
import { HumanForm } from "./human-form";
import { Area, Num, Select, Text, type SetConfig } from "./inspector-fields";
import { TriggerForm } from "./trigger-form";

interface FormProps {
  c: any;
  set: SetConfig;
  ro: boolean;
}

function AgentForm({ c, set, ro }: FormProps) {
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
      <Text
        value={(c.commands ?? []).join(", ")}
        disabled={ro}
        onChange={(v) =>
          set({
            commands: v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }
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
      return <AgentForm {...props} />;
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
