/**
 * Command center first load: the projects' Agent Servers are the backends, so they
 * are registered before Canvas' first-run gate (which would otherwise ask for a
 * backend that the factory already provides). Without the factory API nothing
 * changes: the query fails quietly and the upstream onboarding runs as usual.
 */
import React from "react";
import { useProjects } from "./api";
import { useSyncProjectBackends } from "./project-context";

/** True while the factory API answer is awaited (render a loader, not onboarding). */
export function useFactoryBootstrap(
  onProjects: () => void,
  enabled: boolean,
): boolean {
  const { data, isPending } = useProjects();
  useSyncProjectBackends();
  const done = Boolean(data?.length);
  React.useEffect(() => {
    if (enabled && done) onProjects();
  }, [enabled, done, onProjects]);
  return enabled && isPending;
}
