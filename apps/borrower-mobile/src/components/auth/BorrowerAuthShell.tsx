import type { ReactNode } from "react";
import { Shield } from "lucide-react";

/** Full wordmark from marketing site (white variant for dark borrower theme). */
const LOGO_SRC = "/branding/phindu-logo-white.png";

type BorrowerAuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BorrowerAuthShell({ title, subtitle, children, footer }: BorrowerAuthShellProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8 sm:py-12 max-w-md mx-auto">
        <header className="mb-8 animate-fade-in">
          <div className="mb-8">
            <img
              src={LOGO_SRC}
              alt="Phindu Credit Solutions"
              className="h-12 w-auto max-w-[220px] object-contain object-left"
              width={220}
              height={48}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">{subtitle}</p>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 space-y-4 text-center animate-fade-in">
          {footer}
          <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
            Your information is protected
          </p>
        </footer>
      </div>
    </div>
  );
}
