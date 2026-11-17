"use client";

import * as React from "react";
import { Toaster } from "sonner";
import {
  applyThemeToDocument,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_MODE,
  normalizeThemeColor,
  normalizeThemeMode,
  THEME_COLOR_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  type ThemeColor,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setColor: (color: ThemeColor) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const themeListeners = new Set<() => void>();

function notifyThemeSubscribers() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeThemeStore(listener: () => void) {
  themeListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === THEME_MODE_STORAGE_KEY ||
      event.key === THEME_COLOR_STORAGE_KEY
    ) {
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored) return normalizeThemeMode(stored);
  } catch {
    // Ignore storage access errors
  }
  return normalizeThemeMode(document.documentElement.dataset.mode);
}

function readStoredColor(): ThemeColor {
  try {
    const stored = window.localStorage.getItem(THEME_COLOR_STORAGE_KEY);
    if (stored) return normalizeThemeColor(stored);
  } catch {
    // Ignore storage access errors
  }
  return normalizeThemeColor(document.documentElement.dataset.theme);
}

const getServerMode = (): ThemeMode => DEFAULT_THEME_MODE;
const getServerColor = (): ThemeColor => DEFAULT_THEME_COLOR;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = React.useSyncExternalStore(subscribeThemeStore, readStoredMode, getServerMode);
  const color = React.useSyncExternalStore(subscribeThemeStore, readStoredColor, getServerColor);

  React.useEffect(() => {
    applyThemeToDocument(mode, color);
  }, [mode, color]);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    const normalized = normalizeThemeMode(nextMode);
    try {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage write errors
    }
    applyThemeToDocument(normalized, readStoredColor());
    notifyThemeSubscribers();
  }, []);

  const toggleMode = React.useCallback(() => {
    const current = readStoredMode();
    setMode(current === "dark" ? "light" : "dark");
  }, [setMode]);

  const setColor = React.useCallback((nextColor: ThemeColor) => {
    const normalized = normalizeThemeColor(nextColor);
    try {
      window.localStorage.setItem(THEME_COLOR_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage write errors
    }
    applyThemeToDocument(readStoredMode(), normalized);
    notifyThemeSubscribers();
  }, []);

  const value = React.useMemo(
    () => ({ mode, color, setMode, toggleMode, setColor }),
    [mode, color, setMode, toggleMode, setColor]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Toaster theme={mode} richColors position="top-right" />
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return context;
}
