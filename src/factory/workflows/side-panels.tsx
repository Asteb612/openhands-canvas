/**
 * Right-hand side of the editor: the inspector (selected node, or the workflow's
 * settings, palette and actions) and, for a project's workflow, its runs.
 */
import React from "react";
import { Link } from "react-router";
import { MessageSquare } from "lucide-react";
import { cn } from "#/utils/utils";
import type { FactoryRun, WorkflowScope } from "../api";
import { since } from "../format";
import { useFactoryT } from "../i18n";
import { conversationPath } from "../project-context";
import { RunStateChip } from "../run-status";
import { StateMessage } from "../ui";
import { problemsByNode } from "./graph";
import { NodeInspector, WorkflowSettings } from "./inspector";
import { Palette } from "./palette";
import type { SidePanel, WorkflowEditorState } from "./use-workflow-editor";
import { WorkflowActions } from "./workflow-actions";

function RunsPanel({ project, runs }: { project: string; runs: FactoryRun[] }) {
  const t = useFactoryT();
  if (runs.length === 0)
    return <StateMessage kind="empty">{t("wfNoRuns")}</StateMessage>;
  return (
    <ul className="flex flex-col gap-2" data-testid="wf-runs">
      {runs.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-base-secondary p-2 text-sm"
          data-testid={`wf-run-${r.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-content">
              <span className="font-medium">#{r.issue}</span> {r.title}
            </span>
            <RunStateChip state={r.state} />
          </div>
          <span className="text-xs text-muted">
            {t("wfRunMeta", { run: r.id, v: r.version })}
            {r.node ? ` · ${r.nodeLabel ?? r.node}` : ""}
            {r.prNumber ? ` · ${t("prNumber", { n: r.prNumber })}` : ""}
            {r.updatedAt ? ` · ${since(t, r.updatedAt)}` : ""}
          </span>
          {r.conversationId && (
            <Link
              to={conversationPath(project, r.conversationId)}
              className="inline-flex items-center gap-1 self-start text-xs text-muted underline-offset-2 hover:text-content hover:underline"
            >
              <MessageSquare className="size-3.5" aria-hidden />
              {t("openConversation")}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SidePanels({
  scope,
  editor,
  commands,
  onOpen,
}: {
  scope: WorkflowScope;
  editor: WorkflowEditorState;
  commands: string[];
  onOpen: (id: string) => void;
}) {
  const t = useFactoryT();
  const { def, summary, readOnly, panel, setPanel, selectedNode } = editor;
  // Phones: the panel sits under the canvas; bring a tapped node's form into view.
  const aside = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!selectedNode || !window.matchMedia?.("(max-width: 767px)").matches)
      return;
    aside.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [selectedNode]);
  if (!def) return null;
  const node = def.nodes.find((n) => n.id === selectedNode) ?? null;
  const project = scope.kind === "project" ? scope.project : null;
  const tabs: [SidePanel, string][] = [
    ["inspect", node ? t("wfTabNode") : t("workflow")],
  ];
  if (project)
    tabs.push(["runs", t("wfTabRuns", { n: editor.workflowRuns.length })]);
  const current = project ? panel : "inspect";
  return (
    <aside
      ref={aside}
      className="flex w-full shrink-0 flex-col border-t border-border md:w-80 md:border-t-0 md:border-l"
      data-testid="wf-side"
    >
      <div className="flex border-b border-border" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={current === k}
            data-testid={`wf-side-${k}`}
            onClick={() => setPanel(k)}
            className={cn(
              "flex-1 cursor-pointer border-b-2 px-2 py-2.5 text-sm",
              current === k
                ? "border-primary font-medium text-content"
                : "border-transparent text-muted hover:text-content",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 p-4 md:overflow-y-auto">
        {current === "runs" && project && (
          <RunsPanel project={project} runs={editor.workflowRuns} />
        )}
        {current === "inspect" &&
          (node ? (
            <NodeInspector
              node={node}
              readOnly={readOnly}
              commands={commands}
              problems={
                problemsByNode(editor.validation?.problems ?? []).get(
                  node.id,
                ) ?? []
              }
              onChange={(n) => editor.changeNode(node.id, n)}
              onRename={(to) => editor.rename(node.id, to)}
              onDelete={() =>
                editor.onNodesChange([{ type: "remove", id: node.id }])
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              <WorkflowSettings
                def={def}
                readOnly={readOnly}
                onChange={editor.update}
              />
              {!readOnly && <Palette onAdd={editor.addNode} />}
              {summary && (
                <WorkflowActions
                  scope={scope}
                  summary={summary}
                  dirty={editor.dirty}
                  onOpen={onOpen}
                />
              )}
            </div>
          ))}
      </div>
    </aside>
  );
}
