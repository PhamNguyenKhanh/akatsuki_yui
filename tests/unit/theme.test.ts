import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  applyThemeToDocument,
  buildThemeInitScript,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_MODE,
  normalizeThemeColor,
  normalizeThemeMode,
  THEME_COLOR_OPTIONS,
  THEME_COLOR_STORAGE_KEY,
  THEME_COLORS,
  THEME_MODE_STORAGE_KEY,
  THEME_MODES,
} from "@/lib/theme";

describe("Theme System — Light/Dark Modes & 5 Color Palettes", () => {
  it("exposes all 2 modes and 5 color options (green, blue, purple, pink, gray)", () => {
    expect(THEME_MODES).toEqual(["light", "dark"]);
    expect(THEME_COLORS).toEqual(["gray", "green", "blue", "purple", "pink"]);
    expect(THEME_COLOR_OPTIONS.map((opt) => opt.id)).toEqual([
      "green",
      "blue",
      "purple",
      "pink",
      "gray",
    ]);
  });

  it("normalizes valid and invalid theme modes and color palettes safely", () => {
    expect(normalizeThemeMode("DARK")).toBe("dark");
    expect(normalizeThemeMode(" light ")).toBe("light");
    expect(normalizeThemeMode("invalid")).toBe(DEFAULT_THEME_MODE);
    expect(normalizeThemeMode(null)).toBe(DEFAULT_THEME_MODE);

    expect(normalizeThemeColor("GREEN")).toBe("green");
    expect(normalizeThemeColor("blue")).toBe("blue");
    expect(normalizeThemeColor("purple")).toBe("purple");
    expect(normalizeThemeColor("pink")).toBe("pink");
    expect(normalizeThemeColor("gray")).toBe("gray");
    expect(normalizeThemeColor("orange")).toBe(DEFAULT_THEME_COLOR);
  });

  it("applies mode, color dataset, dark class, and colorScheme to target document", () => {
    const classSet = new Set<string>();
    const fakeDoc = {
      documentElement: {
        dataset: {} as Record<string, string>,
        classList: {
          toggle(name: string, force?: boolean) {
            if (force) classSet.add(name);
            else classSet.delete(name);
          },
        },
        style: {} as Record<string, string>,
      },
    } as unknown as Document;

    applyThemeToDocument("dark", "purple", fakeDoc);
    expect(fakeDoc.documentElement.dataset.mode).toBe("dark");
    expect(fakeDoc.documentElement.dataset.theme).toBe("purple");
    expect(classSet.has("dark")).toBe(true);
    expect(fakeDoc.documentElement.style.colorScheme).toBe("dark");

    applyThemeToDocument("light", "pink", fakeDoc);
    expect(fakeDoc.documentElement.dataset.mode).toBe("light");
    expect(fakeDoc.documentElement.dataset.theme).toBe("pink");
    expect(classSet.has("dark")).toBe(false);
    expect(fakeDoc.documentElement.style.colorScheme).toBe("light");
  });

  it("executes boot script safely against mocked localStorage to restore persisted theme before paint", () => {
    const storage = new Map<string, string>([
      [THEME_MODE_STORAGE_KEY, "dark"],
      [THEME_COLOR_STORAGE_KEY, "blue"],
    ]);
    const classSet = new Set<string>();
    const fakeDoc = {
      documentElement: {
        dataset: {} as Record<string, string>,
        classList: {
          toggle(name: string, force?: boolean) {
            if (force) classSet.add(name);
            else classSet.delete(name);
          },
        },
        style: {} as Record<string, string>,
      },
    };

    vm.runInNewContext(buildThemeInitScript(), {
      document: fakeDoc,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
      },
    });

    expect(fakeDoc.documentElement.dataset.mode).toBe("dark");
    expect(fakeDoc.documentElement.dataset.theme).toBe("blue");
    expect(classSet.has("dark")).toBe(true);
  });

  it("defines CSS selectors for dark mode and all 5 color palettes in globals.css", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain('@custom-variant dark (&:where([data-mode="dark"]');
    expect(css).toContain(':root[data-theme="green"]');
    expect(css).toContain(':root[data-theme="blue"]');
    expect(css).toContain(':root[data-theme="purple"]');
    expect(css).toContain(':root[data-theme="pink"]');
    expect(css).toContain(':root[data-mode="dark"]');
    expect(css).toContain(':root[data-mode="dark"][data-theme="green"]');
    expect(css).toContain(':root[data-mode="dark"][data-theme="blue"]');
    expect(css).toContain(':root[data-mode="dark"][data-theme="purple"]');
    expect(css).toContain(':root[data-mode="dark"][data-theme="pink"]');
  });
});
