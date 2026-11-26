import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import type { GitChangeStatus } from "#/api/open-hands.types";
import { cn } from "#/utils/utils";
import { FileDiffViewer } from "./file-diff-viewer";

export interface DiffChangeListItem {
  path: string;
  status: GitChangeStatus;
}

export interface DiffChangeListProps {
  changes: DiffChangeListItem[];
  /**
   * When set, each row shows that commit's version of the file instead of
   * the working-tree diff.
   */
  commit?: string;
}

/** A folder of the change tree; `name` may join single-child folders ("a/b/c"). */
export interface DiffTreeFolder {
  name: string;
  path: string;
  folders: DiffTreeFolder[];
  files: { name: string; change: DiffChangeListItem }[];
  count: number;
}

/** Path shown for a change: the new path of a rename ("R old new"). */
export function displayPath(change: DiffChangeListItem): string {
  if (change.status === "R") {
    const parts = change.path.split(/\s+/).slice(1);
    return parts[parts.length - 1] ?? change.path;
  }
  return change.path;
}

/**
 * Factory fork: changes as a folder tree (folders first, then files, sorted),
 * single-child folder chains compacted like VS Code ("backend/src/features").
 */
export function buildDiffTree(changes: DiffChangeListItem[]): DiffTreeFolder {
  const root: DiffTreeFolder = {
    name: "",
    path: "",
    folders: [],
    files: [],
    count: 0,
  };
  for (const change of changes) {
    const parts = displayPath(change).split("/").filter(Boolean);
    const fileName = parts.pop() ?? change.path;
    let node = root;
    node.count += 1;
    for (const part of parts) {
      const path = node.path ? `${node.path}/${part}` : part;
      let next = node.folders.find((f) => f.path === path);
      if (!next) {
        next = { name: part, path, folders: [], files: [], count: 0 };
        node.folders.push(next);
      }
      next.count += 1;
      node = next;
    }
    node.files.push({ name: fileName, change });
  }
  const compact = (f: DiffTreeFolder): DiffTreeFolder => {
    let cur = f;
    while (cur !== root && cur.files.length === 0 && cur.folders.length === 1) {
      const [only] = cur.folders;
      cur = { ...only, name: `${cur.name}/${only.name}` };
    }
    return {
      ...cur,
      folders: cur.folders
        .map(compact)
        .sort((a, b) => a.name.localeCompare(b.name)),
      files: [...cur.files].sort((a, b) => a.name.localeCompare(b.name)),
    };
  };
  return compact(root);
}

// Indent per depth (Tailwind v4 integer spacing: 16px a level), capped so a deep
// tree stays readable in a narrow panel.
const FILE_INDENT = [
  "pl-0",
  "pl-4",
  "pl-8",
  "pl-12",
  "pl-16",
  "pl-20",
  "pl-24",
];
const FOLDER_INDENT = [
  "pl-3",
  "pl-7",
  "pl-11",
  "pl-15",
  "pl-19",
  "pl-23",
  "pl-27",
];
const indent = (classes: string[], depth: number) =>
  classes[Math.min(depth, classes.length - 1)];

function FolderRows({
  folder,
  depth,
  commit,
  expandedPath,
  setExpandedPath,
  collapsed,
  toggleFolder,
}: {
  folder: DiffTreeFolder;
  depth: number;
  commit?: string;
  expandedPath: string | null;
  setExpandedPath: (fn: (prev: string | null) => string | null) => void;
  collapsed: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  return (
    <>
      {folder.folders.map((sub) => {
        const isOpen = !collapsed.has(sub.path);
        return (
          <div key={sub.path} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleFolder(sub.path)}
              aria-expanded={isOpen}
              data-testid={`diff-tree-folder-${sub.path}`}
              className={cn(
                "flex h-8 items-center gap-1.5 border-b border-border pr-3 text-left text-xs text-muted hover:cursor-pointer hover:text-content",
                indent(FOLDER_INDENT, depth),
              )}
            >
              {isOpen ? (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              )}
              {isOpen ? (
                <FolderOpen className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Folder className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate font-mono">
                {sub.name}
              </span>
              <span className="shrink-0 tabular-nums">{sub.count}</span>
            </button>
            {isOpen && (
              <FolderRows
                folder={sub}
                depth={depth + 1}
                commit={commit}
                expandedPath={expandedPath}
                setExpandedPath={setExpandedPath}
                collapsed={collapsed}
                toggleFolder={toggleFolder}
              />
            )}
          </div>
        );
      })}
      {folder.files.map(({ name, change }) => (
        <div
          key={change.path}
          className={indent(FILE_INDENT, depth)}
          data-testid="diff-tree-file"
        >
          <FileDiffViewer
            path={change.path}
            type={change.status}
            commit={commit}
            label={name}
            isExpanded={expandedPath === change.path}
            onToggle={() =>
              setExpandedPath((prev) =>
                prev === change.path ? null : change.path,
              )
            }
          />
        </div>
      ))}
    </>
  );
}

/**
 * Single-open accordion of file diffs, grouped in a folder tree. Expanding one
 * path collapses the previously open one (same behavior as the Commits list).
 */
export function DiffChangeList({ changes, commit }: DiffChangeListProps) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => buildDiffTree(changes), [changes]);
  const toggleFolder = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div data-testid="diff-change-list" className="w-full flex flex-col">
      <FolderRows
        folder={tree}
        depth={0}
        commit={commit}
        expandedPath={expandedPath}
        setExpandedPath={setExpandedPath}
        collapsed={collapsed}
        toggleFolder={toggleFolder}
      />
    </div>
  );
}
