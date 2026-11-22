import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { cn } from "#/utils/utils";
import { roundedPath, routeEdge, type RoutedEdgeData } from "./graph";

/** Orthogonal link that goes around nodes (see routeEdge). */
function RoutedEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  label,
  selected,
  markerEnd,
  style,
}: EdgeProps<Edge<RoutedEdgeData, "routed">>) {
  const { d, label: at } = React.useMemo(() => {
    const points = routeEdge(
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      data?.obstacles ?? [],
      data?.lane ?? 0,
      { source: data?.sourceBox, target: data?.targetBox },
    );
    return roundedPath(points);
  }, [sourceX, sourceY, targetX, targetY, data]);
  const problem = !!data?.problem;
  return (
    <>
      <BaseEdge
        path={d}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.5,
          ...(problem ? { stroke: "var(--color-danger, #ef4444)" } : {}),
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "pointer-events-none absolute rounded border bg-base-secondary px-1 text-xs text-muted",
              problem ? "border-danger" : "border-border",
              selected && "text-content",
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const RoutedEdge = React.memo(RoutedEdgeView);
