"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  FileText,
  FolderKanban,
  History,
  Kanban,
  Layers,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MailCheck,
  Menu,
  Shield,
  UserCog,
  Users,
  Video,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { RoleBadge } from "@/components/shared/status-badge";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/auth.actions";
import { PERMISSIONS } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

export interface SidebarActiveProject {
  id: string;
  name: string;
}

export interface SidebarSubNavItem {
  key: "tasks" | "sprints" | "kanban" | "backlog" | "schedule" | "meetings";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Dự án",
    href: "/projects",
    icon: FolderKanban,
    requiredPermission: PERMISSIONS.PROJECT_READ,
  },
  {
    label: "Tài liệu",
    href: "/documents",
    icon: FileText,
    requiredPermission: PERMISSIONS.DOCUMENT_READ,
  },
  {
    label: "Thông báo",
    href: "/notifications",
    icon: Bell,
    requiredPermission: PERMISSIONS.NOTIFICATION_READ,
  },
  {
    label: "Báo cáo & Phân tích",
    href: "/reports",
    icon: BarChart3,
    requiredPermission: PERMISSIONS.REPORT_READ,
  },
  {
    label: "Lịch sử hoạt động",
    href: "/activity",
    icon: History,
    requiredPermission: PERMISSIONS.ACTIVITY_READ,
  },
  {
    label: "Project Templates",
    href: "/admin/templates",
    icon: Layers,
    requiredAnyPermissions: [PERMISSIONS.PROJECT_TEMPLATE_MANAGE],
  },
  {
    label: "Quản lý tài khoản",
    href: "/admin/users",
    icon: Users,
    requiredPermission: PERMISSIONS.ACCOUNT_READ,
  },
  {
    label: "Phân quyền (Roles)",
    href: "/admin/roles",
    icon: Shield,
    requiredPermission: PERMISSIONS.ROLE_MANAGE,
  },
  {
    label: "Lịch sử gửi Email",
    href: "/admin/notifications/deliveries",
    icon: MailCheck,
    requiredPermission: PERMISSIONS.NOTIFICATION_DELIVERY_READ,
  },
  {
    label: "Hồ sơ cá nhân",
    href: "/profile",
    icon: UserCog,
  },
];

interface ActiveProjectQuickLinkSpec {
  key: SidebarSubNavItem["key"];
  label: string;
  segment: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions: readonly string[];
}

const ACTIVE_PROJECT_QUICK_LINK_SPECS: readonly ActiveProjectQuickLinkSpec[] = [
  {
    key: "tasks",
    label: "Quản lý Task",
    segment: "tasks",
    icon: CheckSquare,
    requiredPermissions: [PERMISSIONS.TASK_READ],
  },
  {
    key: "sprints",
    label: "Quản lý Sprint",
    segment: "sprints",
    icon: CalendarRange,
    requiredPermissions: [PERMISSIONS.SPRINT_READ],
  },
  {
    key: "kanban",
    label: "Kanban Board",
    segment: "kanban",
    icon: Kanban,
    requiredPermissions: [PERMISSIONS.TASK_READ, PERMISSIONS.SPRINT_READ],
  },
  {
    key: "backlog",
    label: "Product Backlog",
    segment: "backlog",
    icon: ListTodo,
    requiredPermissions: [PERMISSIONS.TASK_READ, PERMISSIONS.SPRINT_READ],
  },
  {
    key: "schedule",
    label: "Lịch bận (Schedule)",
    segment: "schedule",
    icon: CalendarClock,
    requiredPermissions: [PERMISSIONS.SCHEDULE_READ],
  },
  {
    key: "meetings",
    label: "Cuộc họp (Meet)",
    segment: "meetings",
    icon: Video,
    requiredPermissions: [PERMISSIONS.MEETING_READ],
  },
];

/** Builds permission-filtered quick navigation links for the currently ACTIVE project. */
export function buildActiveProjectSubItems(
  activeProject: SidebarActiveProject | null | undefined,
  permissions: readonly string[]
): SidebarSubNavItem[] {
  if (!activeProject) return [];

  return ACTIVE_PROJECT_QUICK_LINK_SPECS.filter((spec) =>
    spec.requiredPermissions.every((perm) => permissions.includes(perm))
  ).map((spec) => ({
    key: spec.key,
    label: spec.label,
    href: `/projects/${activeProject.id}/${spec.segment}`,
    icon: spec.icon,
  }));
}

export function isSidebarPathMatch(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  idPrefix,
  pathname,
  visibleNavItems,
  activeProject,
  activeProjectSubItems,
  projectsMenuOpen,
  onToggleProjectsMenu,
  onNavigate,
}: {
  idPrefix: "desktop" | "mobile";
  pathname: string;
  visibleNavItems: NavItem[];
  activeProject: SidebarActiveProject | null;
  activeProjectSubItems: SidebarSubNavItem[];
  projectsMenuOpen: boolean;
  onToggleProjectsMenu: () => void;
  onNavigate: () => void;
}) {
  const activeProjectOverviewHref = activeProject ? `/projects/${activeProject.id}` : null;
  const isOverviewActive =
    activeProjectOverviewHref !== null && pathname === activeProjectOverviewHref;
  const isSubItemActive = activeProjectSubItems.some((sub) =>
    isSidebarPathMatch(pathname, sub.href)
  );
  const isChildRouteActive = isOverviewActive || isSubItemActive;

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isProjectsItem = item.href === "/projects";
        const isRouteActive = isSidebarPathMatch(pathname, item.href);

        if (!isProjectsItem) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isRouteActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        }

        const submenuId = `${idPrefix}-projects-submenu`;
        const parentToneClass = isRouteActive
          ? isChildRouteActive
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground";

        return (
          <div key={item.href} className="space-y-1">
            <div className={cn("flex items-center rounded-md transition-colors", parentToneClass)}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-md px-3 py-2 text-sm font-medium"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
              <button
                type="button"
                onClick={onToggleProjectsMenu}
                aria-expanded={projectsMenuOpen}
                aria-controls={submenuId}
                aria-label={
                  projectsMenuOpen
                    ? "Thu gọn menu nhanh Project đang hoạt động"
                    : "Mở rộng menu nhanh Project đang hoạt động"
                }
                data-testid={`${idPrefix}-projects-dropdown-toggle`}
                className={cn(
                  "mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isRouteActive && !isChildRouteActive
                    ? "text-primary-foreground/90 hover:bg-primary-foreground/15"
                    : "hover:bg-background/60"
                )}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-150",
                    projectsMenuOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>

            {projectsMenuOpen && (
              <div
                id={submenuId}
                data-testid={`${idPrefix}-projects-submenu`}
                className="ml-4 space-y-0.5 border-l border-border pl-2.5 pt-0.5"
              >
                {activeProject ? (
                  <>
                    <Link
                      href={activeProjectOverviewHref!}
                      onClick={onNavigate}
                      title={`Project đang hoạt động: ${activeProject.name}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isOverviewActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/85 hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          isOverviewActive ? "bg-primary-foreground" : "bg-emerald-500"
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{activeProject.name}</span>
                    </Link>

                    {activeProjectSubItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = isSidebarPathMatch(pathname, subItem.href);
                      return (
                        <Link
                          key={subItem.key}
                          href={subItem.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                            isSubActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <SubIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </>
                ) : (
                  <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                    Chưa có Project đang hoạt động.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  initialUnreadCount = 0,
  activeProject = null,
  children,
}: {
  user: AuthContext;
  initialUnreadCount?: number;
  activeProject?: SidebarActiveProject | null;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isProjectsRoute = isSidebarPathMatch(pathname, "/projects");
  const isInActiveProjectSubRoute = Boolean(
    activeProject && isSidebarPathMatch(pathname, `/projects/${activeProject.id}`)
  );

  const [projectsMenuOpen, setProjectsMenuOpen] = React.useState(isProjectsRoute);
  const prevPathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prevPathname === pathname) return;

    const wasProjectsRoute = isSidebarPathMatch(prevPathname, "/projects");
    if ((!wasProjectsRoute && isProjectsRoute) || isInActiveProjectSubRoute) {
      setProjectsMenuOpen(true);
    }
  }, [pathname, isProjectsRoute, isInActiveProjectSubRoute]);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.requiredPermission && !user.permissions.includes(item.requiredPermission as never)) {
      return false;
    }
    if (
      item.requiredAnyPermissions &&
      !item.requiredAnyPermissions.some((perm) => user.permissions.includes(perm as never))
    ) {
      return false;
    }
    return true;
  });

  const activeProjectSubItems = buildActiveProjectSubItems(activeProject, user.permissions);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground">
            Akatsuki Yui
          </Link>
        </div>
        <SidebarNav
          idPrefix="desktop"
          pathname={pathname}
          visibleNavItems={visibleNavItems}
          activeProject={activeProject}
          activeProjectSubItems={activeProjectSubItems}
          projectsMenuOpen={projectsMenuOpen}
          onToggleProjectsMenu={() => setProjectsMenuOpen((prev) => !prev)}
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          Akatsuki Yui · MVP v1.0
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-64 flex-col bg-card shadow-lg">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <span className="text-lg font-bold text-foreground">Akatsuki Yui</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarNav
              idPrefix="mobile"
              pathname={pathname}
              visibleNavItems={visibleNavItems}
              activeProject={activeProject}
              activeProjectSubItems={activeProjectSubItems}
              projectsMenuOpen={projectsMenuOpen}
              onToggleProjectsMenu={() => setProjectsMenuOpen((prev) => !prev)}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">Internal Workspace</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            {user.permissions.includes(PERMISSIONS.NOTIFICATION_READ) && (
              <NotificationBell initialUnreadCount={initialUnreadCount} />
            )}
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/profile"
                className="text-right text-sm font-medium text-foreground hover:underline"
              >
                {user.fullName}
              </Link>
              {user.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 overflow-x-clip p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
