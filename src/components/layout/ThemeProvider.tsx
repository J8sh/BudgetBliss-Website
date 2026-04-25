"use client";

import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme | string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "theme";

// Runs before React hydration via next/script strategy="beforeInteractive".
// Sets the theme class on <html> immediately to prevent FOUC.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme')||'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);document.documentElement.style.colorScheme=r;}catch(e){}})();`;

function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
  document.documentElement.style.colorScheme = resolved;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  /** Accepted for layout.tsx API compatibility; only "class" is supported. */
  attribute?: "class";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
      // localStorage unavailable in SSR or restricted contexts
    }
    return defaultTheme;
  });

  // Apply theme class whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  // Re-apply when the OS color scheme changes (only relevant when theme = "system")
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme | string) => {
    const validated =
      next === "light" || next === "dark" || next === "system"
        ? (next as Theme)
        : "system";
    setThemeState(validated);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/*
       * next/script with strategy="beforeInteractive" injects this script into
       * <head> during SSR and returns null on the client, so React 19 never
       * sees a <script> element in the component tree.
       */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script
        id="theme-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
      />
      {children}
    </ThemeContext.Provider>
  );
}
