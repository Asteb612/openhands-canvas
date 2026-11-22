import React from "react";
import { ReactFlow, ReactFlowProvider, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useColorTheme } from "#/hooks/use-color-theme";
import { COLOR_THEMES } from "#/themes/color-themes";
import { useWorkflowVersion } from "../api";
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
  workflowId,
  version,
  currentNode,
  height = 260,
}: {
  project: string;
  workflowId: string;
  version: number;
  currentNode: string | null | undefined;
  height?: number;
}) {
  const {
    data: def,
    error,
    isLoading,
  } = useWorkflowVersion({ kind: "project", project }, workflowId, version);
  const t = useFactoryT();
  const colorMode = COLOR_THEMES[useColorTheme()].appearance;
  const flow = React.useMemo(() => {
    if (!def) return null;
    const f = toFlow(def, {
      readOnly: true,
      runsByNode: currentNode ? new Map([[currentNode, 1]]) : undefined,
    });
    return {
      nodes: f.nodes.map((n) => ({
        ...n,
        selected: n.id === currentNode,
        draggable: false,
        selectable: false,
      })),
      edges: f.edges,
    };
  }, [def, currentNode]);

  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !flow)
    return <p className="text-sm text-muted">{t("graphUnavailable")}</p>;
  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-border"
      // eslint-disable-next-line shadcn/no-inline-styles -- caller-chosen height
      style={{ height }}
      data-testid="factory-workflow-preview"
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
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
            if (!currentNode) return;
            window.setTimeout(() => {
              void instance.fitView({
                nodes: [{ id: currentNode }],
                maxZoom: 0.9,
                padding: 1.5,
              });
            }, 50);
          }}
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
