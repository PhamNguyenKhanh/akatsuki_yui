export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_COLORS = ["gray", "green", "blue", "purple", "pink"] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export const THEME_MODE_STORAGE_KEY = "akatsuki-theme-mode";
export const THEME_COLOR_STORAGE_KEY = "akatsuki-theme-color";

export const DEFAULT_THEME_MODE: ThemeMode = "light";
export const DEFAULT_THEME_COLOR: ThemeColor = "gray";

export interface ThemeColorOption {
  id: ThemeColor;
  label: string;
  swatchHex: string;
}

export const THEME_COLOR_OPTIONS: readonly ThemeColorOption[] = [
  { id: "green", label: "Xanh lá", swatchHex: "#16a34a" },
  { id: "blue", label: "Xanh dương", swatchHex: "#2563eb" },
  { id: "purple", label: "Tím", swatchHex: "#7c3aed" },
  { id: "pink", label: "Hồng", swatchHex: "#db2777" },
  { id: "gray", label: "Xám", swatchHex: "#475569" },
] as const;

export function normalizeThemeMode(value: unknown): ThemeMode {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "light" || normalized === "dark") {
      return normalized;
    }
  }
  return DEFAULT_THEME_MODE;
}

export function normalizeThemeColor(value: unknown): ThemeColor {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if ((THEME_COLORS as readonly string[]).includes(normalized)) {
      return normalized as ThemeColor;
    }
  }
  return DEFAULT_THEME_COLOR;
}

export function applyThemeToDocument(
  mode: ThemeMode,
  color: ThemeColor,
  targetDoc: Document = document
): void {
  const root = targetDoc.documentElement;
  root.dataset.mode = mode;
  root.dataset.theme = color;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

/**
 * Generates an inline boot script injected into `<head>` so stored theme preferences
 * apply before first paint without causing FOUC or React hydration mismatch.
 */
export function buildThemeInitScript(): string {
  return `(function(){try{var m=localStorage.getItem(${JSON.stringify(THEME_MODE_STORAGE_KEY)});var c=localStorage.getItem(${JSON.stringify(THEME_COLOR_STORAGE_KEY)});var mode=(m==="dark"||m==="light")?m:${JSON.stringify(DEFAULT_THEME_MODE)};var colors=${JSON.stringify(THEME_COLORS)};var color=colors.indexOf(c)!==-1?c:${JSON.stringify(DEFAULT_THEME_COLOR)};var r=document.documentElement;r.dataset.mode=mode;r.dataset.theme=color;r.classList.toggle("dark",mode==="dark");r.style.colorScheme=mode;}catch(_e){}})();`;
}
