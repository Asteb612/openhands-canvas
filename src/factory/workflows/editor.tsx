/**
 * Workflow editor: toolbar, notices, the React Flow canvas (controlled from the
 * definition) and the side panels. One instance per (scope, workflow).
 */
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { useColorTheme } from "#/hooks/use-color-theme";
import { COLOR_THEMES } from "#/themes/color-themes";
import {
  reportFactoryError,
  useResetWorkflow,
  type WorkflowScope,
} from "../api";
import { useFactoryT } from "../i18n";
import { Button, Notice, StateMessage, useConfirm } from "../ui";
import { TYPE_COLOR_HEX } from "./defaults";
import type { WorkflowFlowNode } from "./graph";
import { SidePanels } from "./side-panels";
import { EditorToolbar, StatsSummary } from "./toolbar";
import { useWorkflowEditor } from "./use-workflow-editor";
import { RoutedEdge } from "./workflow-edge";
import { WorkflowNodeCard } from "./workflow-node";

const nodeTypes = { workflow: WorkflowNodeCard };
const edgeTypes = { routed: RoutedEdge };

/** A project's copy whose template has a newer version: take it, behind a confirmation. */
function TemplateUpdateNotice({
  scope,
  workflowId,
  update,
  dirty,
}: {
  scope: WorkflowScope;
  workflowId: string;
  update: { templateId: string; from: number; to: number };
  dirty: boolean;
}) {
  const t = useFactoryT();
  const reset = useResetWorkflow();
  const { ask, modal } = useConfirm();
  return (
    <div className="border-b border-border px-4 py-2">
      <Notice tone="info" testId="wf-template-update">
        <RefreshCw className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          {t("templateUpdate", {
            t: update.templateId,
            from: update.from,
            to: update.to,
          })}
        </span>
        <Button
          type="button"
          variant="secondary"
          testId="wf-apply-template-update"
          isDisabled={dirty || reset.isPending}
          onClick={() =>
            ask(
              t("wfTemplateUpdateConfirm", {
                t: update.templateId,
                v: update.to,
              }),
              () =>
                reset.mutate(
                  { scope, id: workflowId },
                  {
                    onSuccess: (r) =>
                      displaySuccessToast(t("wfSaved", { v: r.version })),
                    onError: reportFactoryError,
                  },
                ),
            )
          }
        >
          {t("applyTemplateUpdate")}
        </Button>
      </Notice>
      {modal}
    </div>
  );
}

export function Editor({
  scope,
  workflowId,
  initialNode,
  commands,
  onOpen,
}: {
  scope: WorkflowScope;
  workflowId: string;
  initialNode?: string | null;
  commands: string[];
  onOpen: (id: string) => void;
}) {
  const t = useFactoryT();
  const editor = useWorkflowEditor({ scope, workflowId, initialNode });
  // Follow Canvas' own theme (it does not follow prefers-color-scheme).
  const colorMode = COLOR_THEMES[useColorTheme()].appearance;
  const { query, def, summary, readOnly, flow } = editor;

  // Error first: a failed load never becomes an endless "Loading…".
  if (query.error)
    return (
      <div className="flex-1 p-5">
        <StateMessage kind="error">
          {t("wfLoadError", { id: workflowId, msg: query.error.message })}
        </StateMessage>
      </div>
    );
  if (query.isLoading || !def)
    return (
      <div className="flex-1 px-5">
        <StateMessage kind="loading" />
      </div>
    );

  const globalProblems = (editor.validation?.problems ?? []).filter(
    (p) => !p.node && !p.edge,
  );
  return (
    <div className="flex min-h-0 min-w-0 flex-1" data-testid="wf-editor">
      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar scope={scope} editor={editor} />
        {scope.kind === "project" && summary?.templateUpdate && (
          <TemplateUpdateNotice
            scope={scope}
            workflowId={workflowId}
            update={summary.templateUpdate}
            dirty={editor.dirty}
          />
        )}
        {scope.kind === "project" && editor.stats && (
          <StatsSummary project={scope.project} stats={editor.stats} />
        )}
        {globalProblems.length > 0 && (
          <div className="border-b border-border px-4 py-2">
            <Notice tone="danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <ul className="flex flex-col gap-0.5">
                {globalProblems.map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}
        <div className="relative min-h-0 flex-1" data-testid="wf-canvas">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onConnect={editor.onConnect}
            onPaneClick={editor.clearSelection}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
            colorMode={colorMode}
            fitView
            minZoom={0.2}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap<WorkflowFlowNode>
              pannable
              zoomable
              // The minimap fills SVG shapes: it needs a literal colour.
              nodeColor={(n) => TYPE_COLOR_HEX[n.data.node.type]}
            />
          </ReactFlow>
        </div>
      </div>
      <SidePanels
        scope={scope}
        editor={editor}
        commands={commands}
        onOpen={onOpen}
      />
    </div>
  );
}
