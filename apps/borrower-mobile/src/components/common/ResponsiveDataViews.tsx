import type { ReactNode } from "react";
import { cn } from "@phinduloans/shared/lib/utils";

/**
 * Desktop/tablet: horizontally scrollable table. Hidden below `md` so the mobile card stack shows.
 */
export function DesktopTableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("hidden w-full overflow-x-auto rounded-md border border-border/40 md:block", className)}>{children}</div>
  );
}

/** Small screens: vertical card stack. Hidden from `md` upward. */
export function MobileCardStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 md:hidden", className)}>{children}</div>;
}

/** Sticky action bar on small screens for long forms; static on `md+`. */
export function MobileStickyFormFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3 md:static md:z-0 md:mx-0 md:mt-6 md:border-0 md:bg-transparent md:p-0 md:pb-0 md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
