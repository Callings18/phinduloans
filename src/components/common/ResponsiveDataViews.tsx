import { ReactNode } from "react";

/**
 * Wraps a table in a horizontally-scrollable container so it stays usable on
 * narrower desktops/tablets. Hidden below `md` so the mobile card stack shows.
 */
export const DesktopTableWrap = ({ children }: { children: ReactNode }) => (
  <div className="hidden md:block w-full overflow-x-auto rounded-md border border-border">
    {children}
  </div>
);

/**
 * Renders a vertical stack of cards on small screens. Hidden from `md` upward
 * so the desktop table takes over.
 */
export const MobileCardStack = ({ children }: { children: ReactNode }) => (
  <div className="md:hidden flex flex-col gap-3">{children}</div>
);

export default { DesktopTableWrap, MobileCardStack };
