import { cn } from "@phinduloans/shared/lib/utils";

const MARK_SRC = "/branding/phindu-logo-mark.png";
const WORDMARK_LIGHT = "/branding/phindu-logo-white.png";
const WORDMARK_DARK = "/branding/phindu-logo.png";

type BorrowerBrandLockupProps = {
  variant?: "auth" | "header";
  theme?: "dark" | "light";
  className?: string;
};

export function BorrowerBrandLockup({
  variant = "auth",
  theme = "dark",
  className,
}: BorrowerBrandLockupProps) {
  if (variant === "header") {
    return (
      <img
        src={theme === "light" ? WORDMARK_DARK : WORDMARK_LIGHT}
        alt="Phindu Credit Solutions"
        className={cn("h-8 w-auto max-w-[140px] object-contain object-left", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-12 w-12 rounded-xl gradient-primary shadow-glow flex items-center justify-center shrink-0 p-2">
        <img src={MARK_SRC} alt="" className="h-full w-full object-contain" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-foreground font-bold text-lg tracking-wide">PHINDU</p>
        <p className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">Credit Solutions</p>
      </div>
    </div>
  );
}
