import { describe, expect, it } from "vitest";
import { parseSpeckitTasks } from "#/factory/speckit-tasks";

const MD = `# Tâches : Espace « Activité » (#792)

## État d'avancement

Texte libre sans tâche.

## Phase 0 : Mise en route

- [x] T001 Installer les dépendances : \`pnpm install\`
- [ ] T002 [P] Lister les appelants

## Phase 3 : L'écran

### Histoire 1 — le commercial écrit

- [X] T040 [P] [US1] Composer le message
- [ ] T041 [US1] Envoyer
`;

describe("parseSpeckitTasks", () => {
  it("reads phases, sub-sections, ids, [P] and stories", () => {
    const r = parseSpeckitTasks(MD);
    expect([r.done, r.total]).toEqual([2, 4]);
    expect(r.phases.map((p) => [p.title, p.done, p.total])).toEqual([
      ["Phase 0 : Mise en route", 1, 2],
      ["Phase 3 : L'écran", 1, 2],
    ]);
    expect(r.phases[0].groups[0].tasks[1]).toEqual({
      id: "T002",
      done: false,
      parallel: true,
      story: null,
      text: "Lister les appelants",
    });
    const g = r.phases[1].groups[0];
    expect(g).toMatchObject({
      title: "Histoire 1 — le commercial écrit",
      sub: true,
    });
    expect(g.tasks[0]).toMatchObject({
      id: "T040",
      done: true,
      parallel: true,
      story: "US1",
      text: "Composer le message",
    });
  });

  it("is empty for a file without tasks", () => {
    expect(parseSpeckitTasks("# Rien\n\n## Phase\n\ntexte")).toEqual({
      phases: [],
      done: 0,
      total: 0,
    });
  });
});
