import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface ExternalRedirectProps {
  /** Absolute URL, e.g. https://office.phindu.com/admin */
  to: string;
  /** When true, append current pathname + search after the target origin (for /admin/* → office). */
  preservePath?: boolean;
}

/**
 * React Router's <Navigate> only supports in-app paths. Absolute URLs like
 * https://office.phindu.com/admin become broken relative routes and hit NotFound.
 */
export default function ExternalRedirect({ to, preservePath = false }: ExternalRedirectProps) {
  const location = useLocation();

  useEffect(() => {
    try {
      if (preservePath) {
        const target = new URL(to);
        const dest = `${target.origin}${location.pathname}${location.search}${location.hash}`;
        window.location.replace(dest);
        return;
      }
      // Preserve query/hash for deep links (e.g. /dashboard?tab=payments → app).
      const target = new URL(to);
      if (location.search && !target.search) {
        target.search = location.search;
      }
      if (location.hash && !target.hash) {
        target.hash = location.hash;
      }
      window.location.replace(target.toString());
    } catch {
      window.location.replace(to);
    }
  }, [to, preservePath, location.pathname, location.search, location.hash]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground">
      Redirecting…
    </div>
  );
}
