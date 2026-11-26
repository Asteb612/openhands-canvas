import type { GitChangeStatus } from "#/api/open-hands.types";

interface Change {
  path: string;
  status: GitChangeStatus;
}

/** Path shown for a change: the new path of a rename ("R old new"). */
export function displayPath(change: Change): string {
  if (change.status === "R") {
    const parts = change.path.split(/\s+/).slice(1);
    return parts[parts.length - 1] ?? change.path;
  }
  return change.path;
}

/** Factory fork: orchestrator files (.factory/: ticket card, COMMANDS.md...) are not the agent's work. */
export function isFactoryInternal(change: Change): boolean {
  return displayPath(change).split("/").includes(".factory");
}
