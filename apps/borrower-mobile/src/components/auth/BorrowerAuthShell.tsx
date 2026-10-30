import type { ReactNode } from "react";
import { ArrowLeft, Lock, Shield } from "lucide-react";
import { BorrowerBrandLockup } from "@/components/common/BorrowerBrandLockup";

type BorrowerAuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
};

export function BorrowerAuthShell({
  title,
  subtitle,
  children,
  footer,
  showBack,
  onBack,
}: BorrowerAuthShellProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8 sm:py-12 max-w-md mx-auto">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
        )}

        <header className="mb-8 animate-fade-in">
          <div className="mb-8 flex justify-center sm:justify-start">
            <BorrowerBrandLockup variant="auth" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{subtitle}</p>
          ) : null}
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 space-y-4 text-center animate-fade-in">
          {footer}
          <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
            Your information is protected
            <Lock className="h-3 w-3 opacity-70" aria-hidden />
          </p>
        </footer>
      </div>
    </div>
  );
}
