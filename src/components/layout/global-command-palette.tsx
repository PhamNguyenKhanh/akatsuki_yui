"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResultPayload {
  projects: Array<{ id: string; name: string; status: string }>;
  tasks: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    projectId: string;
    projectName: string;
  }>;
  sprints: Array<{
    id: string;
    name: string;
    status: string;
    projectId: string;
    projectName: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    projectId: string;
    projectName: string;
  }>;
}

interface PaletteItem {
  key: string;
  group: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_NAV_ITEMS: PaletteItem[] = [
  { key: "nav-dashboard", group: "Điều hướng nhanh", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "nav-projects", group: "Điều hướng nhanh", label: "Danh sách Dự án", href: "/projects", icon: FolderKanban },
  { key: "nav-documents", group: "Điều hướng nhanh", label: "Thư viện Tài liệu", href: "/documents", icon: FileText },
];

export function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultPayload>({
    projects: [],
    tasks: [],
    sprints: [],
    documents: [],
  });
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: SearchResultPayload };
        if (json?.data) {
          setResults(json.data);
          setActiveIndex(0);
        }
      } catch {
        // Ignore abort / network errors
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const items = React.useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return QUICK_NAV_ITEMS;
    }

    const list: PaletteItem[] = [];
    for (const p of results.projects) {
      list.push({
        key: `proj-${p.id}`,
        group: "Dự án",
        label: p.name,
        sublabel: p.status,
        href: `/projects/${p.id}`,
        icon: FolderKanban,
      });
    }
    for (const t of results.tasks) {
      list.push({
        key: `task-${t.id}`,
        group: "Công việc (Task)",
        label: `[${t.code}] ${t.title}`,
        sublabel: `${t.projectName} · ${t.status}`,
        href: `/projects/${t.projectId}/tasks/${t.id}`,
        icon: CheckSquare,
      });
    }
    for (const s of results.sprints) {
      list.push({
        key: `sprint-${s.id}`,
        group: "Sprint",
        label: s.name,
        sublabel: `${s.projectName} · ${s.status}`,
        href: `/projects/${s.projectId}/sprints/${s.id}`,
        icon: CalendarRange,
      });
    }
    for (const d of results.documents) {
      list.push({
        key: `doc-${d.id}`,
        group: "Tài liệu",
        label: d.title,
        sublabel: `${d.projectName} · ${d.category}`,
        href: `/projects/${d.projectId}/documents`,
        icon: FileText,
      });
    }
    return list;
  }, [query, results]);

  function navigateToItem(item: PaletteItem) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = items[activeIndex];
      if (target) navigateToItem(target);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-8 gap-2 px-2.5 text-xs text-muted-foreground sm:inline-flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Tìm nhanh...</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden"
        aria-label="Tìm nhanh (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Tìm kiếm nhanh toàn hệ thống</DialogTitle>
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Tìm Task, Project, Sprint, Document..."
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {query.trim() ? "Không tìm thấy kết quả phù hợp." : "Nhập từ khóa để tìm kiếm."}
              </p>
            ) : (
              <div className="space-y-1">
                {items.map((item, idx) => {
                  const Icon = item.icon;
                  const showGroupHeader = idx === 0 || items[idx - 1]?.group !== item.group;
                  return (
                    <React.Fragment key={item.key}>
                      {showGroupHeader && (
                        <div className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {item.group}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => navigateToItem(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          idx === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.label}</p>
                          {item.sublabel && (
                            <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
                          )}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
