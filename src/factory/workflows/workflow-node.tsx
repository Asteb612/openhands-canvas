/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import { formatDuration } from "../format";
import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "#/utils/utils";
import type { WorkflowFlowNode } from "./graph";
import { NODE_HEIGHT, NODE_WIDTH } from "./graph";
import { TYPE_COLOR, nodeSummary } from "./defaults";

const TYPE_LABEL: Record<string, string> = {
  trigger: "Déclencheur",
  agent: "Agent",
  check: "Vérification",
  command: "Commande",
  human: "Validation humaine",
  router: "Routeur",
  git: "Git / GitHub",
  wait: "Attente",
  note: "Note",
  end: "Fin",
};

function WorkflowNodeView({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const { node, ports, optional, problems, runs, stats } = data;
  const color = TYPE_COLOR[node.type];
  const hasInput = node.type !== "trigger";
  return (
    <div
      data-testid={`wf-node-${node.id}`}
      className={cn(
        "rounded-lg border bg-surface text-foreground shadow-sm",
        selected ? "border-contrast" : "border-border",
        problems.length > 0 && "border-status-error",
      )}
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        borderLeft: `4px solid ${color}`,
      }}
      title={problems.join("\n") || undefined}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={{ background: color }}
        />
      )}
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <span className="text-3xs uppercase tracking-wide text-muted">
          {TYPE_LABEL[node.type]}
        </span>
        <span className="flex items-center gap-1">
          {runs > 0 && (
            <span
              className="rounded-full bg-contrast px-1.5 text-3xs text-contrast-foreground"
              title={`${runs} run(s) sur ce nœud`}
            >
              {runs}
            </span>
          )}
          {node.maxVisits ? (
            <span className="text-3xs text-muted" title="Passages maximum">
              ↻{node.maxVisits}
            </span>
          ) : null}
          {problems.length > 0 && (
            <span
              className="text-3xs text-status-error"
              title={problems.join("\n")}
            >
              ⚠ {problems.length}
            </span>
          )}
        </span>
      </div>
      <div className="px-3 text-sm font-semibold truncate">
        {node.label || node.id}
      </div>
      <div className="px-3 pb-2 text-xs text-muted line-clamp-2">
        {nodeSummary(node)}
      </div>
      {stats !== undefined && (
        <div
          className="flex flex-wrap gap-x-2 border-t border-border px-3 py-1 text-2xs text-muted"
          data-testid={`wf-node-stats-${node.id}`}
          title={
            stats
              ? `${stats.entries} passage(s) sur ${stats.runs} run(s)\nmédiane ${formatDuration(stats.medianSeconds)}, moyenne ${formatDuration(stats.avgSeconds)}, max ${formatDuration(stats.maxSeconds)}\n${stats.loops} retour(s) en arrière, ${stats.failedHere} échec(s) ici`
              : "Aucun passage enregistré"
          }
        >
          {stats ? (
            <>
              <span>⏱ {formatDuration(stats.medianSeconds)}</span>
              <span>×{stats.entries}</span>
              {stats.loops > 0 && (
                <span className="text-feedback-warning">↺{stats.loops}</span>
              )}
              {stats.failedHere > 0 && (
                <span className="text-status-error">✗{stats.failedHere}</span>
              )}
            </>
          ) : (
            <span>aucun passage</span>
          )}
        </div>
      )}
      {ports.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-border py-1">
          {ports.map((p) => (
            <div
              key={p}
              className="relative pr-4 text-right text-2xs text-muted"
            >
              {p}
              {optional.includes(p) ? " (opt.)" : ""}
              <Handle
                type="source"
                position={Position.Right}
                id={p}
                style={{ background: color, top: "50%" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const WorkflowNodeCard = React.memo(WorkflowNodeView);
