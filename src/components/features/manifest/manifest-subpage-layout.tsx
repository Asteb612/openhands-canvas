import { useEffect, useRef, type ComponentType } from "react";
import { useLocation } from "react-router";
import { NavigationLink } from "#/components/shared/navigation-link";
import {
  SIDEBAR_ROW_INTERACTIVE_CLASS,
  sidebarNavRowClassName,
} from "#/components/features/sidebar/sidebar-layout";
import { settingsLikeMainScrollClassName } from "#/utils/settings-like-page-layout-classes";
import { cn } from "#/utils/utils";

/** A Lucide icon or an SVG component imported with `?react`. */
type SubPageNavIcon = ComponentType<{
  width?: number;
  height?: number;
  "aria-hidden"?: boolean;
}>;

export interface SubPageNavItem {
  to: string;
  label: string;
  Icon: SubPageNavIcon;
  testId: string;
  /** factory: false keeps the link active on sub-routes (a list and its detail pages). */
  end?: boolean;
}

interface ManifestSubpageLayoutProps {
  /** The section heading above the desktop navigation. */
  heading: string;
  /** Prefix for the desktop/mobile nav testids. */
  navTestIdBase: string;
  items: SubPageNavItem[];
  children: React.ReactNode;
  /**
   * factory: content wider than the settings column (a kanban board, a graph
   * editor): no max width, and the content fills the height without scrolling.
   */
  fullWidth?: boolean;
}

function SubPageNavLink({
  item,
  mobile = false,
}: {
  item: SubPageNavItem;
  /** factory: in the mobile strip, full labels that scroll sideways instead of truncating. */
  mobile?: boolean;
}) {
  return (
    <NavigationLink
      to={item.to}
      end={item.end ?? true}
      data-testid={item.testId}
      className={({ isActive }) =>
        cn(
          sidebarNavRowClassName(),
          mobile
            ? "w-auto shrink-0 whitespace-nowrap"
            : "truncate whitespace-nowrap",
          isActive
            ? SIDEBAR_ROW_INTERACTIVE_CLASS.active
            : SIDEBAR_ROW_INTERACTIVE_CLASS.idle,
        )
      }
    >
      <span className="shrink-0 flex items-center justify-center">
        <item.Icon width={16} height={16} aria-hidden />
      </span>
      <span className={mobile ? undefined : "truncate"}>{item.label}</span>
    </NavigationLink>
  );
}

/**
 * The shell of a manifest-declared sub-page: a sticky desktop aside and a
 * horizontal mobile strip around a settings-like scrolling content column.
 * Purely presentational — what the items are, and whether any exist at all,
 * is the caller's (ultimately the manifest's) statement.
 */
export function ManifestSubpageLayout({
  heading,
  navTestIdBase,
  items,
  children,
  fullWidth = false,
}: ManifestSubpageLayoutProps) {
  // factory: keep the active tab of the mobile strip in view when the route changes.
  const mobileNav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    mobileNav.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <div className="flex h-full gap-4 lg:gap-10 lg:pl-10">
      <aside
        data-testid={`${navTestIdBase}-desktop`}
        className="hidden lg:flex lg:w-65 lg:shrink-0 lg:flex-col lg:gap-2 lg:sticky lg:top-8 lg:self-start"
      >
        <span className="px-2 text-sm font-normal text-contrast">
          {heading}
        </span>
        <div className="flex flex-col gap-0.5 pt-0.5">
          {items.map((item) => (
            <SubPageNavLink key={item.to} item={item} />
          ))}
        </div>
      </aside>
      <main
        className={cn(
          settingsLikeMainScrollClassName,
          // factory: the app's mobile header is already above; less top space on phones.
          "h-full pt-3 lg:pt-8",
          fullWidth && "overflow-y-hidden pb-4",
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 flex-col gap-6",
            fullWidth ? "h-full min-h-0 gap-4" : "max-w-200",
          )}
        >
          <nav
            ref={mobileNav}
            data-testid={`${navTestIdBase}-mobile`}
            className="lg:hidden -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-2 [scrollbar-width:none]"
          >
            {items.map((item) => (
              <SubPageNavLink key={item.to} item={item} mobile />
            ))}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
