import { Plus } from "lucide-react";
import { type NodeType, useNodeTypes } from "../api";
import { useFactoryT } from "../i18n";
import { TYPE_COLOR } from "./defaults";

/** Node types from the server's catalog; a click adds one to the right of the graph. */
export function Palette({ onAdd }: { onAdd: (t: NodeType) => void }) {
  const t = useFactoryT();
  const { data } = useNodeTypes();
  if (!data) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="wf-palette">
      <h3 className="mb-1 text-sm font-medium text-content">
        {t("wfAddNode")}
      </h3>
      {data.catalog.map((c) => (
        <button
          key={c.type}
          type="button"
          title={c.description}
          data-testid={`wf-add-${c.type}`}
          onClick={() => onAdd(c.type)}
          className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-content hover:bg-surface-raised"
        >
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            // eslint-disable-next-line shadcn/no-inline-styles -- node type colour (theme variable)
            style={{ background: TYPE_COLOR[c.type] }}
          />
          <span className="flex-1">{c.label}</span>
          <Plus
            className="size-3.5 text-muted opacity-0 group-hover:opacity-100"
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
