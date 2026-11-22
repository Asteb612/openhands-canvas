/**
 * Workflow tab of a conversation where the agent writes a workflow: the draft as a
 * graph, the orchestrator's verdict, and the owner's Save (a new version, or a new
 * workflow with its id). The agent never saves.
 */
import React from "react";
import { Link } from "react-router";
import { CheckCircle2, ExternalLink, Save } from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { reportFactoryError } from "../api";
import { useFactoryT } from "../i18n";
import {
  Button,
  Field,
  Notice,
  Pill,
  StateMessage,
  fieldClassName,
  textActionClassName,
} from "../ui";
import { ID_RE } from "./inspector-fields";
import { DefinitionGraph } from "./workflow-preview";
import {
  useSaveWorkflowSession,
  useWorkflowSession,
  useWorkflowSessionId,
} from "./workflow-session";

export default function WorkflowSessionTab() {
  const t = useFactoryT();
  const ref = useWorkflowSessionId();
  const { data, error, isLoading } = useWorkflowSession(ref);
  const save = useSaveWorkflowSession();
  const [newId, setNewId] = React.useState("");
  const [saved, setSaved] = React.useState<{
    id: string;
    version: number;
  } | null>(null);
  if (!ref) return null;
  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !data)
    return (
      <StateMessage kind="error">
        {(error as Error | null)?.message}
      </StateMessage>
    );

  const template = data.scope === "template";
  const target = data.workflowId;
  const detail = target
    ? `/factory/workflows/${encodeURIComponent(target)}${template ? "?scope=template" : ""}`
    : null;
  const doSave = () =>
    save.mutate(
      {
        project: ref.project,
        session: ref.session,
        id: target ? undefined : newId,
      },
      {
        onSuccess: (r) => {
          setSaved({ id: r.id, version: r.version });
          displaySuccessToast(t("agentSaved", { id: r.id, v: r.version }));
        },
        onError: reportFactoryError,
      },
    );
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="wf-session-tab"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-base font-medium text-content">
          {data.definition?.name ?? t("agentNewWorkflow")}
        </h2>
        <Pill>
          {template
            ? t("templates")
            : t("projectWorkflows", { p: ref.project })}
        </Pill>
        <Pill
          tone={data.ok ? "success" : "warning"}
          testId="wf-session-validity"
        >
          {data.ok
            ? t("wfValid")
            : t("wfProblems", { n: data.problems.length })}
        </Pill>
        {detail && (
          <Link
            to={detail}
            className={`${textActionClassName} ml-auto inline-flex items-center gap-1`}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t("open")}
          </Link>
        )}
      </header>
      <p className="text-xs text-muted">{t("agentTabHint")}</p>
      {data.definition ? (
        <DefinitionGraph
          def={data.definition}
          ports={data.ports}
          problems={data.problems}
          height={340}
        />
      ) : null}
      {data.problems.length > 0 && (
        <ul
          className="flex flex-col gap-1 text-sm text-danger"
          data-testid="wf-session-problems"
        >
          {data.problems.slice(0, 12).map((p, i) => (
            <li key={i}>
              {p.node ? `${p.node} : ` : ""}
              {p.message}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        {!target && (
          <Field
            label={t("wfIdLabel")}
            hint={t("wfIdRule")}
            className="min-w-48 flex-1"
          >
            <input
              className={fieldClassName}
              value={newId}
              onChange={(e) => setNewId(e.target.value.trim())}
              data-testid="wf-session-id"
            />
          </Field>
        )}
        <Button
          type="button"
          variant="primary"
          testId="wf-session-save"
          isDisabled={
            !data.ok || save.isPending || (!target && !ID_RE.test(newId))
          }
          startContent={<Save className="size-4" aria-hidden />}
          onClick={doSave}
        >
          {target ? t("agentSaveVersion") : t("agentSaveNew")}
        </Button>
      </div>
      {saved && (
        <Notice tone="success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("agentSaved", { id: saved.id, v: saved.version })}</span>
        </Notice>
      )}
    </div>
  );
}
