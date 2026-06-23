import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { InstallAppRequired } from "@/components/common/InstallAppRequired";
import { isBorrowerWebInstallGateEnabled, isStandaloneDisplayMode } from "@phinduloans/shared/utils/pwaDisplayMode";

export type BorrowerInstallGateVariant = "borrower-flows" | "signup-only";

interface BorrowerInstallGateProps {
  children: ReactNode;
  /** `borrower-flows` — apply / dashboard. `signup-only` — block only when URL has mode=signup (staff can still log in on web). */
  variant?: BorrowerInstallGateVariant;
}

/**
 * Enforces PWA-first borrower flows when {@link isBorrowerWebInstallGateEnabled} is true.
 */
export function BorrowerInstallGate({ children, variant = "borrower-flows" }: BorrowerInstallGateProps) {
  const [searchParams] = useSearchParams();
  const gateOn = isBorrowerWebInstallGateEnabled();
  const standalone = isStandaloneDisplayMode();

  if (!gateOn || standalone) {
    return <>{children}</>;
  }

  if (variant === "signup-only") {
    if (searchParams.get("mode") === "signup") {
      return <InstallAppRequired />;
    }
    return <>{children}</>;
  }

  return <InstallAppRequired />;
}
