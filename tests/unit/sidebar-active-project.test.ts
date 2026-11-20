import React from "react";
import { UserStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/modules/auth/auth.actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/components/features/notifications/notification-bell", () => ({
  NotificationBell: () => React.createElement("div", { "data-testid": "notification-bell-mock" }),
}));

vi.mock("@/components/theme/theme-provider", () => ({
  useTheme: () => ({
    mode: "light",
    color: "gray",
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    setColor: vi.fn(),
  }),
}));

import {
  AppShell,
  buildActiveProjectSubItems,
  isSidebarPathMatch,
  type SidebarActiveProject,
} from "@/components/layout/app-shell";

const ACTIVE_PROJECT: SidebarActiveProject = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Akatsuki Capstone",
};

const INACTIVE_PROJECT_ID = "99999999-9999-4999-8999-999999999999";

const fullProjectMember: AuthContext = {
  userId: "33333333-3333-4333-8333-333333333333",
  email: "member@akatsuki.local",
  fullName: "Member Test",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.SPRINT_READ,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
};

function renderShell(
  pathname: string,
  activeProject: SidebarActiveProject | null,
  user = fullProjectMember
) {
  usePathnameMock.mockReturnValue(pathname);
  return renderToStaticMarkup(
    React.createElement(
      AppShell,
      { user, initialUnreadCount: 0, activeProject },
      React.createElement("div", null, "Main Content")
    )
  );
}

describe("Sidebar Active Project Dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds all 4 active project quick links when user has TASK_READ and SPRINT_READ", () => {
    const items = buildActiveProjectSubItems(ACTIVE_PROJECT, fullProjectMember.permissions);

    expect(items.map((i) => ({ key: i.key, label: i.label, href: i.href }))).toEqual([
      {
        key: "tasks",
        label: "Quản lý Task",
        href: `/projects/${ACTIVE_PROJECT.id}/tasks`,
      },
      {
        key: "sprints",
        label: "Quản lý Sprint",
        href: `/projects/${ACTIVE_PROJECT.id}/sprints`,
      },
      {
        key: "kanban",
        label: "Kanban Board",
        href: `/projects/${ACTIVE_PROJECT.id}/kanban`,
      },
      {
        key: "backlog",
        label: "Product Backlog",
        href: `/projects/${ACTIVE_PROJECT.id}/backlog`,
      },
    ]);
  });

  it("filters quick links cleanly according to user permissions", () => {
    const tasksOnly = buildActiveProjectSubItems(ACTIVE_PROJECT, [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.TASK_READ,
    ]);
    expect(tasksOnly.map((i) => i.key)).toEqual(["tasks"]);

    const sprintsOnly = buildActiveProjectSubItems(ACTIVE_PROJECT, [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.SPRINT_READ,
    ]);
    expect(sprintsOnly.map((i) => i.key)).toEqual(["sprints"]);

    expect(buildActiveProjectSubItems(null, fullProjectMember.permissions)).toEqual([]);
  });

  it("matches exact and nested routes without matching sibling prefixes", () => {
    expect(isSidebarPathMatch("/dashboard", "/dashboard")).toBe(true);
    expect(isSidebarPathMatch("/dashboard/extra", "/dashboard")).toBe(false);
    expect(isSidebarPathMatch("/projects", "/projects")).toBe(true);
    expect(
      isSidebarPathMatch(
        `/projects/${ACTIVE_PROJECT.id}/tasks/new`,
        `/projects/${ACTIVE_PROJECT.id}/tasks`
      )
    ).toBe(true);
    expect(
      isSidebarPathMatch(
        `/projects/${INACTIVE_PROJECT_ID}/tasks`,
        `/projects/${ACTIVE_PROJECT.id}/tasks`
      )
    ).toBe(false);
  });

  it("keeps /projects link intact and renders toggle button on non-project routes", () => {
    const html = renderShell("/dashboard", ACTIVE_PROJECT);

    expect(html).toContain('href="/projects"');
    expect(html).toContain("Dự án (Projects)");
    expect(html).toContain('data-testid="desktop-projects-dropdown-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-testid="desktop-projects-submenu"');
  });

  it("renders active project overview and 4 direct links inside submenu on /projects routes", () => {
    const html = renderShell(`/projects/${ACTIVE_PROJECT.id}/kanban`, ACTIVE_PROJECT);

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-testid="desktop-projects-submenu"');
    expect(html).toContain(ACTIVE_PROJECT.name);
    expect(html).toContain(`href="/projects/${ACTIVE_PROJECT.id}"`);
    expect(html).toContain(`href="/projects/${ACTIVE_PROJECT.id}/tasks"`);
    expect(html).toContain(`href="/projects/${ACTIVE_PROJECT.id}/sprints"`);
    expect(html).toContain(`href="/projects/${ACTIVE_PROJECT.id}/kanban"`);
    expect(html).toContain(`href="/projects/${ACTIVE_PROJECT.id}/backlog"`);
    expect(html).toContain("Quản lý Task");
    expect(html).toContain("Quản lý Sprint");
    expect(html).toContain("Kanban Board");
    expect(html).toContain("Product Backlog");
  });

  it("renders helpful empty state inside submenu when no active project is accessible", () => {
    const html = renderShell("/projects", null);

    expect(html).toContain('data-testid="desktop-projects-submenu"');
    expect(html).toContain("Chưa có Project đang hoạt động.");
  });
});
