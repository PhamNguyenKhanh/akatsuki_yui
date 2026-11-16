"use client";

import * as React from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { THEME_COLOR_OPTIONS } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  compact = false,
  align = "right",
}: {
  compact?: boolean;
  align?: "left" | "right";
}) {
  const { mode, color, setMode, setColor } = useTheme();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const activeColorOption =
    THEME_COLOR_OPTIONS.find((item) => item.id === color) ?? THEME_COLOR_OPTIONS[4];

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Tùy chỉnh giao diện"
        data-testid="theme-switcher-trigger"
        className="gap-2 bg-card"
      >
        {mode === "dark" ? (
          <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full border border-border"
          style={{ backgroundColor: activeColorOption.swatchHex }}
          data-testid="active-theme-swatch"
          aria-hidden="true"
        />
        {!compact && <span className="hidden sm:inline">Giao diện</span>}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Cài đặt chế độ sáng tối và màu sắc"
          data-testid="theme-switcher-popover"
          className={cn(
            "absolute top-full z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chế độ hiển thị
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode("light")}
                  aria-pressed={mode === "light"}
                  data-testid="theme-mode-light"
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    mode === "light"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  )}
                >
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sáng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("dark")}
                  aria-pressed={mode === "dark"}
                  data-testid="theme-mode-dark"
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    mode === "dark"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  )}
                >
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tối</span>
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Màu chủ đạo</span>
              </p>
              <div className="grid grid-cols-1 gap-1">
                {THEME_COLOR_OPTIONS.map((option) => {
                  const isSelected = color === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setColor(option.id)}
                      aria-pressed={isSelected}
                      data-testid={`theme-color-${option.id}`}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-transparent text-foreground hover:bg-accent/70"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/25"
                          style={{ backgroundColor: option.swatchHex }}
                          aria-hidden="true"
                        />
                        <span>{option.label}</span>
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
