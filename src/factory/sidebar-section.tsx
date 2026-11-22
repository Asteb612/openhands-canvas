/**
 * The factory entry of the Canvas sidebar: one "Factory" link (its pages have their
 * own sub-navigation, like Automate), with the number of decisions waiting.
 */
import { Factory } from "lucide-react";
import { SidebarNavLink } from "#/components/features/sidebar/sidebar-nav-link";
import { cn } from "#/utils/utils";
import { useRuns } from "./api";
import { useFactoryT } from "./i18n";
import { FactoryNotifier } from "./notifier";
import { FactoryProjectSync, useSelectedProject } from "./project-context";

const ICON_SIZE = 18;

export function FactorySidebarSection({ collapsed }: { collapsed: boolean }) {
  const t = useFactoryT();
  const { projects, projectId } = useSelectedProject();
  const { data: runs } = useRuns();
  const waiting = (runs ?? []).filter(
    (r) => r.state === "HUMAN" && (!projectId || r.project === projectId),
  ).length;
  return (
    <>
      {/* Mounted even without projects: it registers their backends once they load. */}
      <FactoryProjectSync />
      {projects.length > 0 && (
        <div className="relative">
          <SidebarNavLink
            to="/factory"
            label={t("factory")}
            testId="sidebar-factory-link"
            collapsed={collapsed}
            icon={<Factory width={ICON_SIZE} height={ICON_SIZE} />}
          />
          {waiting > 0 && (
            <span
              data-testid="sidebar-factory-waiting"
              title={t("decisionsWaiting", { n: waiting })}
              className={cn(
                "pointer-events-none absolute flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-2xs font-semibold leading-4 text-black",
                collapsed
                  ? "right-1 top-0.5"
                  : "right-2 top-1/2 -translate-y-1/2",
              )}
            >
              {waiting}
            </span>
          )}
        </div>
      )}
      <FactoryNotifier />
    </>
  );
}
