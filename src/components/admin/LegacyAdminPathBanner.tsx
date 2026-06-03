import { Link } from "react-router-dom";
import { LayoutGrid, ArrowUpRight, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  houseDisbursementsPath,
  houseLoanDetailPath,
  houseRootPath,
} from "@/utils/adminHousePaths";

type LegacyPage = "applications" | "loans" | "disbursements";

const PAGE_COPY: Record<
  LegacyPage,
  { title: string; body: string; housesLink: string; housesLabel: string }
> = {
  applications: {
    title: "Product Houses are the canonical workflow",
    body: "Create, review, edit, and disburse loans from the matching product house. This applications inbox stays for cross-product queues and legacy actions.",
    housesLink: "/admin/houses",
    housesLabel: "Browse Product Houses",
  },
  loans: {
    title: "Prefer Product Houses for loan operations",
    body: "Each product has its own house with loans, review, disbursements, and collections. This portfolio view remains for cross-product monitoring.",
    housesLink: "/admin/houses",
    housesLabel: "Open Product Houses",
  },
  disbursements: {
    title: "Disburse from the product house when possible",
    body: "House disbursement pages include product-specific checks and schedules. This global list remains for finance oversight.",
    housesLink: "/admin/houses",
    housesLabel: "Product House disbursements",
  },
};

type Props = {
  page: LegacyPage;
  productCode?: string | null;
  loanId?: string | null;
};

export function LegacyAdminPathBanner({ page, productCode, loanId }: Props) {
  const copy = PAGE_COPY[page];
  const code = productCode?.trim().toUpperCase() || null;
  const contextualHref =
    code && loanId
      ? houseLoanDetailPath(code, loanId)
      : code
        ? page === "disbursements"
          ? houseDisbursementsPath(code)
          : houseRootPath(code)
        : null;

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <LayoutGrid className="h-4 w-4 text-primary" />
      <AlertTitle className="text-foreground">{copy.title}</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        <p>{copy.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={copy.housesLink}>
              {copy.housesLabel}
              <ArrowUpRight size={14} className="ml-1" />
            </Link>
          </Button>
          {contextualHref ? (
            <Button asChild size="sm" className="gradient-primary">
              <Link to={contextualHref}>
                Open in {code} house
                <ExternalLink size={14} className="ml-1" />
              </Link>
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
