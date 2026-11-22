import type { BoardColumn, FactoryRun } from "../api";
import type { FactoryKey } from "../i18n";
import { TERMINAL_STATES } from "../states";

export { RUN_STATES, TERMINAL_STATES } from "../states";

type T = (key: FactoryKey) => string;

/** Default board: by run state, what needs the owner first. */
export function defaultColumns(t: T): BoardColumn[] {
  return [
    {
      id: "human",
      title: t("colHuman"),
      hint: t("colHumanHint"),
      states: ["HUMAN"],
    },
    {
      id: "active",
      title: t("colActive"),
      hint: t("colActiveHint"),
      states: ["ACTIVE", "WAITING"],
    },
    {
      id: "queued",
      title: t("colQueued"),
      hint: t("colQueuedHint"),
      states: ["QUEUED", "BLOCKED"],
    },
    {
      id: "failed",
      title: t("colFailed"),
      hint: t("colFailedHint"),
      states: ["FAILED"],
    },
    {
      id: "done",
      title: t("colDone"),
      hint: t("colDoneHint"),
      states: ["COMPLETED", "CANCELLED"],
    },
  ];
}

export const OTHER_COLUMN_ID = "__other";

export function columnMatches(c: BoardColumn, r: FactoryRun): boolean {
  if (c.states?.length && !c.states.includes(r.state)) return false;
  if (c.nodeTypes?.length && !(r.nodeType && c.nodeTypes.includes(r.nodeType)))
    return false;
  if (c.nodes?.length) {
    if (!r.node) return false;
    const hit = c.nodes.some(
      (k) => k === `${r.workflow}/${r.node}` || k === `*/${r.node}`,
    );
    if (!hit) return false;
  }
  return true;
}

/** Only terminal states: a history column (most recent first, shortened). */
export function isHistoryColumn(c: BoardColumn): boolean {
  return (
    !!c.states?.length && c.states.every((s) => TERMINAL_STATES.includes(s))
  );
}

/** Runs grouped by column (first match wins), filtered by project and text. */
export function groupRuns(
  runs: FactoryRun[],
  filter: { project?: string; text?: string; workflow?: string },
  columns: BoardColumn[],
  other: Omit<BoardColumn, "id"> = { title: "Other" },
): { columns: BoardColumn[]; groups: Record<string, FactoryRun[]> } {
  const q = (filter.text ?? "").trim().toLowerCase();
  const kept = runs.filter(
    (r) =>
      (!filter.project || r.project === filter.project) &&
      (!filter.workflow || r.workflow === filter.workflow) &&
      (!q ||
        `#${r.issue} ${r.title} ${r.workflowName ?? r.workflow} ${r.nodeLabel ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const groups: Record<string, FactoryRun[]> = Object.fromEntries(
    columns.map((c) => [c.id, []]),
  );
  const leftovers: FactoryRun[] = [];
  for (const r of kept) {
    const c = columns.find((col) => columnMatches(col, r));
    if (c) groups[c.id]!.push(r);
    else leftovers.push(r);
  }
  const cols = leftovers.length
    ? [...columns, { ...other, id: OTHER_COLUMN_ID }]
    : columns;
  if (leftovers.length) groups[OTHER_COLUMN_ID] = leftovers;
  for (const c of cols) {
    const history = isHistoryColumn(c);
    groups[c.id]!.sort((a, b) => {
      const ka = a.nodeEnteredAt ?? a.updatedAt;
      const kb = b.nodeEnteredAt ?? b.updatedAt;
      // Oldest wait first where it matters; most recent first for history.
      return history ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
  }
  return { columns: cols, groups };
}
