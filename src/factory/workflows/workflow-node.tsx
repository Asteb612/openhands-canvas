import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Repeat, RotateCcw, Timer, XCircle } from "lucide-react";
import { cn } from "#/utils/utils";
import { formatDuration } from "../format";
import { useFactoryT } from "../i18n";
import type { WorkflowFlowNode } from "./graph";
import { NODE_HEIGHT, NODE_WIDTH } from "./graph";
import { TYPE_COLOR, TYPE_LABEL, nodeSummary } from "./defaults";

function WorkflowNodeView({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const t = useFactoryT();
  const { node, ports, optional, problems, runs, stats } = data;
  const color = TYPE_COLOR[node.type];
  const hasInput = node.type !== "trigger";
  const statsTitle = stats
    ? t("wfNodeStatsTitle", {
        entries: stats.entries,
        runs: stats.runs,
        median: formatDuration(t, stats.medianSeconds),
        avg: formatDuration(t, stats.avgSeconds),
        max: formatDuration(t, stats.maxSeconds),
        loops: stats.loops,
        failed: stats.failedHere,
      })
    : t("wfNoPassage");
  return (
    <div
      data-testid={`wf-node-${node.id}`}
      className={cn(
        "rounded-lg border bg-base-secondary text-content shadow-sm",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        problems.length > 0 && "border-danger",
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
        <span className="text-xs tracking-wide text-muted uppercase">
          {t(TYPE_LABEL[node.type])}
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {runs > 0 && (
            <span
              className="rounded-full bg-primary px-1.5 text-on-primary"
              title={t("wfRunsOnNode", { n: runs })}
            >
              {runs}
            </span>
          )}
          {node.maxVisits ? (
            <span
              className="inline-flex items-center gap-0.5 text-muted"
              title={t("wfMaxVisits")}
            >
              <Repeat className="size-3" aria-hidden />
              {node.maxVisits}
            </span>
          ) : null}
          {problems.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-danger"
              title={problems.join("\n")}
            >
              <AlertTriangle className="size-3" aria-hidden />
              {problems.length}
            </span>
          )}
        </span>
      </div>
      <div className="truncate px-3 text-sm font-medium">
        {node.label || node.id}
      </div>
      <div className="line-clamp-2 px-3 pb-2 text-xs text-muted">
        {nodeSummary(node, t)}
      </div>
      {stats !== undefined && (
        <div
          className="flex flex-wrap items-center gap-x-2 border-t border-border px-3 py-1 text-xs text-muted"
          data-testid={`wf-node-stats-${node.id}`}
          title={statsTitle}
        >
          {stats ? (
            <>
              <span className="inline-flex items-center gap-0.5">
                <Timer className="size-3" aria-hidden />
                {formatDuration(t, stats.medianSeconds)}
              </span>
              <span>×{stats.entries}</span>
              {stats.loops > 0 && (
                <span className="inline-flex items-center gap-0.5 text-warning">
                  <RotateCcw className="size-3" aria-hidden />
                  {stats.loops}
                </span>
              )}
              {stats.failedHere > 0 && (
                <span className="inline-flex items-center gap-0.5 text-danger">
                  <XCircle className="size-3" aria-hidden />
                  {stats.failedHere}
                </span>
              )}
            </>
          ) : (
            <span>{t("wfNoPassage")}</span>
          )}
        </div>
      )}
      {ports.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-border py-1">
          {ports.map((p) => (
            <div
              key={p}
              className="relative pr-4 text-right text-xs text-muted"
            >
              {p}
              {optional.includes(p) ? ` ${t("wfOptionalPort")}` : ""}
              <Handle
                type="source"
                position={Position.Right}
                id={p}
                // eslint-disable-next-line shadcn/no-inline-styles -- type colour
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
