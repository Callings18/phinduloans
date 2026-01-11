import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  
  return {
    theme: (theme || "dark") as "dark" | "light" | "system",
    setTheme,
    resolvedTheme: (resolvedTheme || "dark") as "dark" | "light",
  };
}
