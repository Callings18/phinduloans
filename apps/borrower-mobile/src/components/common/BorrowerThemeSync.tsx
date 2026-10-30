import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@phinduloans/shared/theme/ThemeProvider";

/** Auth screens stay dark; signed-in borrower app matches mockup light dashboard. */
export function BorrowerThemeSync() {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  useEffect(() => {
    const authRoute =
      pathname === "/auth" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/");
    setTheme(authRoute ? "dark" : "light");
  }, [pathname, setTheme]);

  return null;
}
