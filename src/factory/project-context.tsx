/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import { create } from "zustand";
import { cn } from "#/utils/utils";
import { useProjects, type FactoryProject } from "./workflows/api";

const STORAGE_KEY = "factory.project";

function readStored(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

interface ProjectState {
  /** Selected factory project id; "" = every project. */
  projectId: string;
  setProjectId: (id: string) => void;
}

/** The project chosen in the sidebar, shared by the tickets, workflows and project pages. */
export const useFactoryProjectStore = create<ProjectState>((set) => ({
  projectId: typeof window === "undefined" ? "" : readStored(),
  setProjectId: (projectId) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, projectId);
    } catch {
      // private window: the choice only lasts for this tab
    }
    set({ projectId });
  },
}));

/**
 * Selected project, resolved against the projects the orchestrator knows: a stale id
 * (project removed, other backend) falls back to "every project".
 */
export function useSelectedProject(): {
  projectId: string;
  project: FactoryProject | undefined;
  projects: FactoryProject[];
  setProjectId: (id: string) => void;
} {
  const { data } = useProjects();
  const { projectId, setProjectId } = useFactoryProjectStore();
  const projects = data ?? [];
  const project = projects.find((p) => p.id === projectId);
  return {
    projectId: project ? projectId : "",
    project,
    projects,
    setProjectId,
  };
}

/** Sidebar control: which factory project the factory pages show. Hidden without the API. */
export function FactoryProjectSelector({ collapsed }: { collapsed?: boolean }) {
  const { projectId, projects, setProjectId } = useSelectedProject();
  if (projects.length === 0 || collapsed) return null;
  return (
    <label
      className="mx-2 mt-1 flex items-center gap-2 text-xs text-muted"
      data-testid="factory-project-selector"
    >
      <span aria-hidden>🏭</span>
      <span className="sr-only">Projet factory</span>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className={cn(
          "min-w-0 flex-1 cursor-pointer rounded border border-border bg-base-secondary px-1.5 py-0.5 text-xs",
          projectId ? "text-foreground" : "text-muted",
        )}
      >
        <option value="">Tous les projets</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id}
            {p.active ? "" : " (inactif)"}
          </option>
        ))}
      </select>
    </label>
  );
}
