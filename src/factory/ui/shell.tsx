/**
 * Factory pages in the Automate look: the same sub-page shell (left navigation,
 * centered column), page headings, cards, activity rows and status strips as the
 * automations pages, built on their shared classes.
 */
import React from "react";
import {
  Brain,
  FolderCog,
  Kanban,
  LayoutDashboard,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { ManifestSubpageLayout } from "#/components/features/manifest/manifest-subpage-layout";
import {
  automationActivityListClassName,
  automationActivityRowClassName,
  automationCardStatusStripClassName,
} from "#/components/features/automations/automation-view-mode";
import {
  extensionModuleCardGridClassName,
  extensionModuleCardGridContainerClassName,
  extensionModuleCardInteractiveClassName,
  extensionModuleCardPillClassName,
  extensionModuleCardSurfaceClassName,
  extensionModuleEmptyStateClassName,
} from "#/utils/extension-module-card-classes";
import { cn } from "#/utils/utils";
import { useFactoryT } from "../i18n";
import { useSelectedProject } from "../project-context";

export { ManifestOverviewTiles as OverviewTiles } from "#/components/features/manifest/manifest-overview-tiles";
export type { OverviewTileView } from "#/components/features/manifest/manifest-overview-tiles";
export { SectionCard } from "#/components/features/automations/detail/section-card";
export { SectionConnector } from "#/components/features/automations/detail/section-connector";
export { ConfigField } from "#/components/features/automations/detail/config-field";
export { KebabMenu } from "#/components/features/automations/kebab-menu";
export type { KebabMenuItem } from "#/components/features/automations/kebab-menu";
export { AutomationPageHeader as DetailHeader } from "#/components/features/automations/automation-page-header";
export { AutomationViewToggle as ViewToggle } from "#/components/features/automations/automation-view-toggle";
export type { AutomationViewMode as ViewMode } from "#/components/features/automations/automation-view-mode";

/** The Factory area: sub-navigation on the left, the page on the right. */
export function FactoryShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const t = useFactoryT();
  const { project } = useSelectedProject();
  return (
    <ManifestSubpageLayout
      heading={project ? project.name : t("factory")}
      navTestIdBase="factory-navbar"
      fullWidth={fullWidth}
      items={[
        {
          to: "/factory",
          label: t("navDashboard"),
          Icon: LayoutDashboard,
          testId: "factory-nav-dashboard",
        },
        {
          to: "/factory/tickets",
          label: t("navTickets"),
          Icon: Kanban,
          testId: "factory-nav-tickets",
        },
        {
          to: "/factory/workflows",
          label: t("navWorkflows"),
          Icon: WorkflowIcon,
          testId: "factory-nav-workflows",
          end: false,
        },
        {
          to: "/factory/project",
          label: t("navProject"),
          Icon: FolderCog,
          testId: "factory-nav-project",
        },
        {
          to: "/factory/memory",
          label: t("navMemory"),
          Icon: Brain,
          testId: "factory-nav-memory",
        },
      ]}
    >
      {children}
    </ManifestSubpageLayout>
  );
}

/** Title, description and actions of a page, as on the automations dashboard. */
export function PageHeading({
  title,
  description,
  badge,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-semibold text-content">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** A section title inside a page (e.g. "To handle"). */
export function SubHeading({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-content">{children}</h2>
      {meta && <span className="text-xs text-muted">{meta}</span>}
    </div>
  );
}

/** Grid of cards: one column, two from 600px of container width. */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className={extensionModuleCardGridContainerClassName}>
      <div className={extensionModuleCardGridClassName}>{children}</div>
    </div>
  );
}

/** An automation-style card; clickable when `onOpen` is given. */
export function FactoryCard({
  onOpen,
  children,
  className,
  testId,
}: {
  onOpen?: () => void;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      data-testid={testId}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && e.key === "Enter" && e.target === e.currentTarget)
          onOpen();
      }}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden p-4 text-left",
        extensionModuleCardSurfaceClassName,
        onOpen && extensionModuleCardInteractiveClassName,
        onOpen && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card title row: name, badges, and actions on the right. */
export function CardHeader({
  title,
  badges,
  actions,
}: {
  title: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-8 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold leading-none text-content">
          {title}
        </h3>
        {badges}
      </div>
      {actions && (
        // Actions never open the card.

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
      {children}
    </p>
  );
}

/** Small grey pill (trigger, scope, counts). */
export function CardPill({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      className={cn(extensionModuleCardPillClassName, "gap-1")}
      title={title}
    >
      {icon}
      {children}
    </span>
  );
}

/** The inset strip at the bottom of a card (last run). */
export function StatusStrip({ children }: { children: React.ReactNode }) {
  return <div className={automationCardStatusStripClassName}>{children}</div>;
}

/** The bordered list of activity rows. */
export function ActivityList({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className={automationActivityListClassName} data-testid={testId}>
      {children}
    </div>
  );
}

export function ActivityRow({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        automationActivityRowClassName,
        "items-center gap-3 px-4 py-3",
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Empty panel of a list page. */
export function EmptyPanel({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={extensionModuleEmptyStateClassName}>
      <p className="text-sm font-medium text-content">{title}</p>
      {children && (
        <div className="mx-auto mt-2 max-w-md text-sm text-muted">
          {children}
        </div>
      )}
    </div>
  );
}
