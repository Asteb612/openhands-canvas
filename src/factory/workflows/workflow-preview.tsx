import React from "react";
import { ReactFlow, ReactFlowProvider, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useColorTheme } from "#/hooks/use-color-theme";
import { COLOR_THEMES } from "#/themes/color-themes";
import {
  useWorkflowVersion,
  type Problem,
  type ValidationResponse,
  type WorkflowDefinition,
  type WorkflowScope,
} from "../api";
import { useFactoryT } from "../i18n";
import { StateMessage } from "../ui";
import { toFlow } from "./graph";
import { WorkflowNodeCard } from "./workflow-node";
import { RoutedEdge } from "./workflow-edge";

const nodeTypes = { workflow: WorkflowNodeCard };
const edgeTypes = { routed: RoutedEdge };

/**
 * Read-only view of the exact workflow version a run follows (in its project's
 * scope), centred on the current node (selected + run badge).
 */
export function WorkflowPreview({
  project,
  scope,
  workflowId,
  version,
  currentNode,
  height = 260,
}: {
  /** The project whose workflow it is (or give `scope`, e.g. a template). */
  project?: string;
  scope?: WorkflowScope;
  workflowId: string;
  version: number;
  currentNode: string | null | undefined;
  height?: number;
}) {
  const {
    data: def,
    error,
    isLoading,
  } = useWorkflowVersion(
    scope ?? { kind: "project", project: project ?? "" },
    workflowId,
    version,
  );
  const t = useFactoryT();
  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !def)
    return <p className="text-sm text-muted">{t("graphUnavailable")}</p>;
  return (
    <DefinitionGraph def={def} currentNode={currentNode} height={height} />
  );
}

/** A workflow definition drawn read-only (a saved version, or a draft). */
export function DefinitionGraph({
  def,
  currentNode,
  ports,
  problems,
  height = 260,
  selected,
  onNodeClick,
}: {
  def: WorkflowDefinition;
  currentNode?: string | null;
  ports?: ValidationResponse["ports"];
  problems?: Problem[];
  height?: number;
  /** Highlighted node (a draft node being edited), without re-centring on it. */
  selected?: string | null;
  /** Nodes become clickable (a draft edited by hand). */
  onNodeClick?: (id: string) => void;
}) {
  const colorMode = COLOR_THEMES[useColorTheme()].appearance;
  const flow = React.useMemo(() => {
    const f = toFlow(def, {
      readOnly: true,
      ports,
      problems,
      runsByNode: currentNode ? new Map([[currentNode, 1]]) : undefined,
    });
    return {
      nodes: f.nodes.map((n) => ({
        ...n,
        selected: n.id === (selected ?? currentNode),
        draggable: false,
        selectable: false,
      })),
      edges: f.edges,
    };
  }, [def, currentNode, ports, problems, selected]);
  // A changed set of nodes (a draft the agent rewrote) is framed again.
  const shape = def.nodes.map((n) => n.id).join(",");
  return (
    <div
      className="w-full shrink-0 overflow-hidden rounded-lg border border-border"
      // eslint-disable-next-line shadcn/no-inline-styles -- caller-chosen height
      style={{ height }}
      data-testid="factory-workflow-preview"
      data-clickable={onNodeClick ? "true" : undefined}
    >
      <ReactFlowProvider key={shape}>
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          onNodeClick={onNodeClick ? (_e, n) => onNodeClick(n.id) : undefined}
          onPaneClick={onNodeClick ? () => onNodeClick("") : undefined}
          colorMode={colorMode}
          fitView
          fitViewOptions={
            currentNode
              ? { nodes: [{ id: currentNode }], maxZoom: 0.9, padding: 1.5 }
              : undefined
          }
          minZoom={0.1}
          // Re-centre once nodes are measured: fitView at mount runs before the
          // node sizes exist when the preview opens inside a just-expanded panel.
          onInit={(instance) => {
            window.setTimeout(() => {
              void instance.fitView(
                currentNode
                  ? { nodes: [{ id: currentNode }], maxZoom: 0.9, padding: 1.5 }
                  : { padding: 0.1 },
              );
            }, 50);
          }}
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
