import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

export type Theme = "dark" | "light" | "system" | "schedule";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    return stored && ["dark", "light", "system", "schedule"].includes(stored) ? stored : defaultTheme;
  }
  return defaultTheme;
}

function getScheduledTheme(timeZone: string): "dark" | "light" {
  try {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    return hour >= 18 || hour < 6 ? "dark" : "light";
  } catch {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6 ? "dark" : "light";
  }
}

function themeFor(selected: Theme, timeZone: string): "dark" | "light" {
  return selected === "system" ? getSystemTheme() : selected === "schedule" ? getScheduledTheme(timeZone) : selected;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "phindu-theme",
  scheduleTimeZone = "Africa/Lusaka",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  scheduleTimeZone?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme));
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    themeFor(getStoredTheme(storageKey, defaultTheme), scheduleTimeZone),
  );

  useEffect(() => {
    const root = document.documentElement;
    const resolved = themeFor(theme, scheduleTimeZone);
    setResolvedTheme(resolved);
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey, scheduleTimeZone]);

  useEffect(() => {
    if (theme !== "system" && theme !== "schedule") return;
    if (theme === "schedule") {
      const refresh = () => {
        const next = getScheduledTheme(scheduleTimeZone);
        setResolvedTheme(next);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(next);
      };
      refresh();
      const timer = window.setInterval(refresh, 30_000);
      return () => window.clearInterval(timer);
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(newTheme);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, scheduleTimeZone]);

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
