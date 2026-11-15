"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { RoleBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/auth.actions";
import { PERMISSIONS } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

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
    label: "Dự án (Projects)",
    href: "/projects",
    icon: FolderKanban,
    requiredPermission: PERMISSIONS.PROJECT_READ,
  },
  {
    label: "Project Templates",
    href: "/admin/templates",
    icon: Layers,
    requiredAnyPermissions: [PERMISSIONS.PROJECT_CREATE, PERMISSIONS.ROLE_MANAGE],
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
    label: "Hồ sơ cá nhân",
    href: "/profile",
    icon: UserCog,
  },
];

export function AppShell({ user, children }: { user: AuthContext; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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

  const navContent = (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Điều hướng chính">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900">
            Akatsuki Yui
          </Link>
        </div>
        {navContent}
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          Sprint 3 · Task Management
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
              <span className="text-lg font-bold text-slate-900">Akatsuki Yui</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {navContent}
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
            <span className="text-sm font-medium text-slate-500">Internal Workspace</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/profile"
                className="text-right text-sm font-medium text-slate-900 hover:underline"
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

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
