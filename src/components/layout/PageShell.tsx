import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard page width containment (spacing stays on each page's root). */
export function PageStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 w-full", className)}>{children}</div>;
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Responsive page title row: stacks on mobile, actions full-width when needed. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

/** Horizontal filter/toolbar row with consistent gap and mobile scroll. */
export function FilterToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", className)}>{children}</div>
  );
}

/** Stats/metric cards grid used across admin dashboards. */
export function StatsGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4", className)}>{children}</div>
  );
}
