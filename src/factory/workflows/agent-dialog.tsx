/**
 * "Create / change with the agent": the owner describes the workflow, a conversation
 * starts on the project's Agent Server with the draft beside it (Workflow tab).
 */
import React from "react";
import { useNavigate } from "react-router";
import { Sparkles, X } from "lucide-react";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { reportFactoryError, type WorkflowSummary } from "../api";
import { useFactoryT } from "../i18n";
import { conversationPath } from "../project-context";
import { Button, Field, selectClassName, textareaClassName } from "../ui";
import { useStartWorkflowSession } from "./workflow-session";

export function AgentWorkflowDialog({
  project,
  scope,
  workflow,
  templates,
  onClose,
}: {
  project: string;
  scope: "project" | "template";
  /** Changing this workflow (else a new one, optionally from a template). */
  workflow?: WorkflowSummary;
  templates?: WorkflowSummary[];
  onClose: () => void;
}) {
  const t = useFactoryT();
  const navigate = useNavigate();
  const start = useStartWorkflowSession();
  const [prompt, setPrompt] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start.mutate(
      {
        project,
        scope,
        workflowId: workflow?.id,
        fromTemplate: !workflow && template ? template : undefined,
        prompt: prompt.trim(),
      },
      {
        onSuccess: (r) => navigate(conversationPath(project, r.conversationId)),
        onError: reportFactoryError,
      },
    );
  };
  const title = workflow
    ? t("agentEditTitle", { name: workflow.name })
    : t("agentCreateTitle");
  return (
    <ModalBackdrop onClose={onClose} aria-label={title}>
      <form
        onSubmit={submit}
        className="flex w-[min(36rem,92vw)] flex-col gap-4 rounded-xl border border-border bg-base-secondary p-5"
        data-testid="wf-agent-dialog"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-medium text-content">{title}</h2>
            <p className="text-sm text-muted">{t("agentDialogHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="cursor-pointer text-muted hover:text-content"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {!workflow && templates && templates.length > 0 && (
          <Field label={t("agentStartFrom")}>
            <select
              className={selectClassName}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              data-testid="wf-agent-template"
            >
              <option value="">{t("agentBlank")}</option>
              {templates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t("agentPrompt")}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className={textareaClassName}
            placeholder={t("agentPromptPlaceholder")}
            data-testid="wf-agent-prompt"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            testId="wf-agent-start"
            isDisabled={prompt.trim().length < 3 || start.isPending}
            startContent={<Sparkles className="size-4" aria-hidden />}
          >
            {t("agentStart")}
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
