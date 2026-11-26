/**
 * Resume a failed or cancelled run at a step of its pinned workflow (orchestrator POST
 * /runs/:id/resume): unlike "Retry", nothing before that step is redone.
 */
import React from "react";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import {
  reportFactoryError,
  useResumeRun,
  useWorkflowVersion,
  type FactoryRun,
} from "./api";
import { useFactoryT } from "./i18n";
import {
  Field,
  StateMessage,
  selectClassName,
  textareaClassName,
  useConfirm,
} from "./ui";

interface Choice {
  node: string;
  comment: string;
}

/** Steps a run can resume at: everything but triggers and ends. */
export function resumableNodes(
  nodes: { id: string; type: string; label?: string }[],
) {
  return nodes.filter((n) => n.type !== "trigger" && n.type !== "end");
}

function ResumeForm({
  run,
  onChange,
}: {
  run: FactoryRun;
  onChange: (c: Choice) => void;
}) {
  const t = useFactoryT();
  const { data, error, isLoading } = useWorkflowVersion(
    { kind: "project", project: run.project },
    run.workflow,
    run.version,
  );
  const nodes = data ? resumableNodes(data.nodes) : [];
  const [node, setNode] = React.useState("");
  const [comment, setComment] = React.useState("");
  React.useEffect(() => {
    if (node || !nodes.length) return;
    const initial = nodes.find((n) => n.id === run.node)?.id ?? nodes[0].id;
    setNode(initial);
  }, [nodes, node, run.node]);
  React.useEffect(() => {
    onChange({ node, comment });
  }, [node, comment, onChange]);

  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !data)
    return (
      <StateMessage kind="error">
        {(error as Error | null)?.message}
      </StateMessage>
    );
  return (
    <div className="flex flex-col gap-3 text-left text-sm">
      <p className="text-muted">{t("resumeHint")}</p>
      <Field label={t("resumeNode")}>
        <select
          className={selectClassName}
          value={node}
          onChange={(e) => setNode(e.target.value)}
          data-testid="resume-node"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label ?? n.id}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("resumeComment")}>
        <textarea
          className={textareaClassName}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          data-testid="resume-comment"
        />
      </Field>
    </div>
  );
}

export function useResume(run: FactoryRun) {
  const t = useFactoryT();
  const resume = useResumeRun();
  const { ask, modal } = useConfirm();
  const choice = React.useRef<Choice>({ node: "", comment: "" });
  const onChange = React.useCallback((c: Choice) => {
    choice.current = c;
  }, []);
  const canResume =
    (run.state === "FAILED" || run.state === "CANCELLED") &&
    !!run.conversationId &&
    !!run.branch;
  const open = () => {
    choice.current = { node: "", comment: "" };
    ask(
      t("resumeTitle", { id: run.id }),
      () => {
        const { node, comment } = choice.current;
        if (!node) return;
        resume.mutate(
          { runId: run.id, node, comment },
          {
            onSuccess: (r) =>
              r.warning
                ? displayErrorToast(r.warning)
                : displaySuccessToast(
                    t("resumed", { id: run.id, node: r.run.node }),
                  ),
            onError: reportFactoryError,
          },
        );
      },
      {
        confirmText: t("resumeConfirm"),
        body: <ResumeForm run={run} onChange={onChange} />,
      },
    );
  };
  return { canResume, open, modal, resuming: resume.isPending };
}
