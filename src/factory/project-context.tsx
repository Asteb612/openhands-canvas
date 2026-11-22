/**
 * Project = Canvas backend. In the command center each factory project's Agent Server
 * is a Canvas backend `factory-<project>` (host `<origin>/agents/<project>`, no key:
 * the ingress adds it). The active project is the active backend: choosing a project
 * switches the backend (conversations, workspaces, agent settings follow), and
 * switching the backend elsewhere in Canvas changes the project.
 */
import React from "react";
import { FolderKanban } from "lucide-react";
import {
  useActiveBackend,
  useActiveBackendContext,
} from "#/contexts/active-backend-context";
import {
  getRegisteredBackends,
  getSnapshot,
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import { BACKEND_QUERY_PARAM } from "#/api/backend-registry/url-selection";
import type { Backend } from "#/api/backend-registry/types";
import { cn } from "#/utils/utils";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { useProjects, type FactoryProject } from "./api";
import { useFactoryT } from "./i18n";
import { selectClassName } from "./ui";

const PREFIX = "factory-";

export const projectBackendId = (project: string) => `${PREFIX}${project}`;

export function projectOfBackend(backendId: string | undefined): string | null {
  return backendId?.startsWith(PREFIX) ? backendId.slice(PREFIX.length) : null;
}

/** In-app link to a project's conversation, resolved against that project's backend. */
export function conversationPath(
  project: string,
  conversationId: string,
): string {
  return `/conversations/${conversationId}?${BACKEND_QUERY_PARAM}=${encodeURIComponent(projectBackendId(project))}`;
}

/** The backends the command center should have for these projects (others kept as they are). */
export function projectBackends(
  current: Backend[],
  projects: FactoryProject[],
  origin: string,
): Backend[] {
  const wanted = projects.filter((p) => p.status !== "error" || p.repo);
  const others = current.filter((b) => !b.id.startsWith(PREFIX));
  const mine = wanted.map((p): Backend => {
    const prev = current.find((b) => b.id === p.backend.id);
    const host = `${origin}${p.backend.path}`;
    return {
      ...(prev ?? {}),
      id: p.backend.id,
      name: p.name,
      host,
      apiKey: "",
      kind: "local",
      // Host change = new connection (invalidates cached data of the old one).
      connectionRevision:
        prev && prev.host !== host
          ? (prev.connectionRevision ?? 0) + 1
          : prev?.connectionRevision,
    };
  });
  return [...others, ...mine];
}

function sameBackends(a: Backend[], b: Backend[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Keeps one Canvas backend per factory project (mounted once, in the sidebar). With no
 * usable backend selected yet, the first running project becomes active.
 */
export function useSyncProjectBackends(): void {
  const { data: projects } = useProjects();
  React.useEffect(() => {
    if (!projects?.length || typeof window === "undefined") return;
    const current = getRegisteredBackends();
    const next = projectBackends(current, projects, window.location.origin);
    if (!sameBackends(current, next)) setRegisteredBackends(next);
    const active = getSnapshot().active.backend.id;
    if (!next.some((b) => b.id === active)) {
      const first = projects.find((p) => p.status === "ok") ?? projects[0];
      if (first) setActiveSelection({ backendId: first.backend.id });
    }
  }, [projects]);
}

/**
 * The Canvas backend context when a provider exists (the app); null in unit tests
 * that mount a component alone. The context is read on every render either way, so
 * the hook order never changes.
 */
function useBackendSwitcher(): ReturnType<
  typeof useActiveBackendContext
> | null {
  try {
    return useActiveBackendContext();
  } catch {
    return null;
  }
}

/** The active project (from the active backend), its config, and how to change it. */
export function useSelectedProject(): {
  projectId: string;
  project: FactoryProject | undefined;
  projects: FactoryProject[];
  setProjectId: (id: string) => void;
} {
  const { data } = useProjects();
  const ctx = useBackendSwitcher();
  const active = useActiveBackend();
  const projects = data ?? [];
  const id = projectOfBackend(active.backend.id);
  const project = projects.find((p) => p.id === id);
  const setActive = ctx?.setActive;
  const setProjectId = React.useCallback(
    (next: string) => {
      const p = projects.find((x) => x.id === next);
      if (!p) return;
      if (setActive) setActive(p.backend.id);
      else setActiveSelection({ backendId: p.backend.id });
    },
    [projects, setActive],
  );
  return {
    projectId: project ? project.id : "",
    project,
    projects,
    setProjectId,
  };
}

function projectSuffix(
  t: ReturnType<typeof useFactoryT>,
  p: FactoryProject,
): string {
  if (p.status === "error") return ` (${t("inError")})`;
  if (p.status === "inactive") return ` (${t("inactive")})`;
  if (p.paused) return ` (${t("paused")})`;
  return "";
}

/** Sidebar control: the active project (= backend). Hidden without the factory API. */
export function FactoryProjectSelector({ collapsed }: { collapsed?: boolean }) {
  useSyncProjectBackends();
  const t = useFactoryT();
  const { projectId, project, projects, setProjectId } = useSelectedProject();
  if (projects.length === 0) return null;
  if (collapsed)
    return (
      <StyledTooltip
        content={project ? project.name : t("noProject")}
        placement="right"
      >
        <span
          className="mx-auto flex size-8 items-center justify-center rounded-md bg-surface-raised text-xs font-medium text-content"
          data-testid="factory-project-badge"
          aria-label={project ? project.name : t("noProject")}
        >
          {project ? (
            project.name.slice(0, 2).toUpperCase()
          ) : (
            <FolderKanban className="size-4" aria-hidden />
          )}
        </span>
      </StyledTooltip>
    );
  return (
    <label
      className="mx-2 mt-1 flex items-center gap-2"
      data-testid="factory-project-selector"
    >
      <FolderKanban className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="sr-only">{t("project")}</span>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className={cn(selectClassName, "h-8 min-h-8 px-2 text-sm")}
      >
        {!projectId && <option value="">{t("noProject")}</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {projectSuffix(t, p)}
          </option>
        ))}
      </select>
    </label>
  );
}
