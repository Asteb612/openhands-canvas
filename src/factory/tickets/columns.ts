import type { BoardColumn, FactoryRun } from "../workflows/api";

export const RUN_STATES = [
  "QUEUED",
  "BLOCKED",
  "ACTIVE",
  "HUMAN",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const TERMINAL_STATES = ["COMPLETED", "FAILED", "CANCELLED"];

/** Default board: by run state, what needs the owner first. */
export const DEFAULT_COLUMNS: BoardColumn[] = [
  {
    id: "human",
    title: "À valider",
    hint: "une décision t'attend",
    states: ["HUMAN"],
  },
  {
    id: "active",
    title: "En cours",
    hint: "l'agent travaille ou attend un évènement",
    states: ["ACTIVE", "WAITING"],
  },
  {
    id: "queued",
    title: "En file",
    hint: "pas encore pris en charge",
    states: ["QUEUED", "BLOCKED"],
  },
  {
    id: "failed",
    title: "Échec",
    hint: "à relancer ou abandonner",
    states: ["FAILED"],
  },
  {
    id: "done",
    title: "Terminés",
    hint: "terminés ou annulés",
    states: ["COMPLETED", "CANCELLED"],
  },
];

/** Catch-all column for runs no custom column matches. */
export const OTHER_COLUMN: BoardColumn = {
  id: "__other",
  title: "Autres",
  hint: "aucune colonne ne correspond",
};

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
  columns: BoardColumn[] = DEFAULT_COLUMNS,
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
  const other: FactoryRun[] = [];
  for (const r of kept) {
    const c = columns.find((col) => columnMatches(col, r));
    if (c) groups[c.id]!.push(r);
    else other.push(r);
  }
  const cols = other.length ? [...columns, OTHER_COLUMN] : columns;
  if (other.length) groups[OTHER_COLUMN.id] = other;
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
