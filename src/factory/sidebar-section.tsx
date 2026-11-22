/** The factory block of the Canvas sidebar: the active project's pages, notifications. */
import { FolderCog, Kanban, Workflow } from "lucide-react";
import { SidebarNavLink } from "#/components/features/sidebar/sidebar-nav-link";
import { useFactoryT } from "./i18n";
import { FactoryNotifier } from "./notifier";
import { FactoryProjectSync, useSelectedProject } from "./project-context";

const ICON_SIZE = 18;

export function FactorySidebarSection({ collapsed }: { collapsed: boolean }) {
  const t = useFactoryT();
  const { projects } = useSelectedProject();
  return (
    <>
      {/* Mounted even without projects: it registers their backends once they load. */}
      <FactoryProjectSync />
      {projects.length > 0 && (
        <>
          <SidebarNavLink
            to="/factory/tickets"
            label={t("navTickets")}
            testId="sidebar-factory-tickets-link"
            collapsed={collapsed}
            icon={<Kanban width={ICON_SIZE} height={ICON_SIZE} />}
          />
          <SidebarNavLink
            to="/factory/workflows"
            label={t("navWorkflows")}
            testId="sidebar-factory-workflows-link"
            collapsed={collapsed}
            icon={<Workflow width={ICON_SIZE} height={ICON_SIZE} />}
          />
          <SidebarNavLink
            to="/factory/project"
            label={t("navProject")}
            testId="sidebar-factory-project-link"
            collapsed={collapsed}
            icon={<FolderCog width={ICON_SIZE} height={ICON_SIZE} />}
          />
        </>
      )}
      <FactoryNotifier />
    </>
  );
}
