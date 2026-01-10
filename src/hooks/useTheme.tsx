import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): "dark" | "light" => {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("phindu-theme") as Theme;
      return stored || "dark";
    }
    return "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    } else {
      setResolvedTheme(theme);
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }

    localStorage.setItem("phindu-theme", theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
