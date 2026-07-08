import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@phinduloans/shared/components/ui/button";
import { ArrowRight, CheckCircle2, Loader2, Package, Shield } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";
import {
  fetchActiveLoanProducts,
  type LoanProductRow,
} from "@phinduloans/shared/services/repositories/loanProductsRepository";
import {
  formatCurrency,
  getInterestPeriodLabel,
} from "@phinduloans/shared/utils/loanCalculations";
import { isBorrowerPortalProduct } from "@phinduloans/shared/utils/borrowerPortalIntegration";
import { borrowerAppPath } from "@/config/publicUrls";
import { Link } from "react-router-dom";

function buildRequirementsSummary(product: LoanProductRow): string[] {
  const items: string[] = [];

  if (product.min_amount != null && product.max_amount != null) {
    items.push(`Amount: ${formatCurrency(product.min_amount)} – ${formatCurrency(product.max_amount)}`);
  }
  if (product.min_term_months != null && product.max_term_months != null) {
    const unit = product.term_unit || "months";
    items.push(`Term: ${product.min_term_months}–${product.max_term_months} ${unit}`);
  }
  if (product.min_age != null) {
    items.push(`Minimum age: ${product.min_age} years`);
  }
  if (product.collateral_required) {
    items.push("Collateral required");
  }
  if (product.crb_check_required) {
    items.push("Credit bureau check");
  }
  if (product.guarantee_required) {
    items.push("Guarantor may be required");
  }
  if (product.requirements?.length) {
    for (const req of product.requirements) {
      if (!items.includes(req)) items.push(req);
    }
  }

  return items.slice(0, 6);
}

function productApplyUrl(productId: string): string {
  return borrowerAppPath(`/auth?mode=signup&apply=true&product=${productId}`);
}

const LoanProducts = () => {
  const queryClient = useQueryClient();

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ["active-loan-products"],
    queryFn: () => fetchActiveLoanProducts({ sort: "name", ascending: true }),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const portalProducts = (products ?? []).filter(isBorrowerPortalProduct);

  useEffect(() => {
    if (apiFeatureFlags.loanProducts) return;

    const channel = supabase
      .channel("loan-products-marketing")
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["active-loan-products"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <section className="gradient-hero py-20 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Our <span className="text-gradient">Loan Products</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Flexible credit solutions designed for individuals and small businesses across Zambia.
                Compare products and apply online in minutes.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading loan products…</p>
              </div>
            ) : isError ? (
              <div className="max-w-xl mx-auto text-center glass rounded-3xl p-10">
                <p className="text-muted-foreground mb-6">
                  We couldn&apos;t load products right now. Please try again later or contact us for assistance.
                </p>
                <Button variant="outline" asChild>
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            ) : portalProducts.length === 0 ? (
              <div className="max-w-xl mx-auto text-center glass rounded-3xl p-10">
                <Package className="mx-auto mb-4 text-muted-foreground" size={40} />
                <p className="text-muted-foreground mb-6">
                  No products are currently available for online application. Please check back soon or get in touch.
                </p>
                <Button variant="hero" asChild>
                  <a href={borrowerAppPath("/auth?mode=signup")}>Create Account</a>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {portalProducts.map((product) => {
                  const requirements = buildRequirementsSummary(product);
                  const interestLabel = getInterestPeriodLabel(product.interest_period as Parameters<typeof getInterestPeriodLabel>[0]);

                  return (
                    <article
                      key={product.id}
                      className="glass rounded-3xl p-8 flex flex-col border border-border hover:border-primary/40 transition-all duration-300"
                    >
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-5">
                        <Package className="text-primary-foreground" size={24} />
                      </div>

                      <h2 className="text-xl font-bold text-foreground mb-2">{product.name}</h2>

                      <p className="text-sm font-medium text-primary mb-3">
                        {product.interest_rate}% {product.interest_type || "flat"} {interestLabel}
                      </p>

                      <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">
                        {product.description ||
                          "A flexible loan product tailored to your needs. Full terms are provided in your loan agreement upon approval."}
                      </p>

                      {requirements.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Shield size={14} />
                            Key requirements
                          </p>
                          <ul className="space-y-2">
                            {requirements.map((req) => (
                              <li key={req} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button variant="hero" className="w-full mt-auto" asChild>
                        <a href={productApplyUrl(product.id)}>
                          Apply for {product.name}
                          <ArrowRight size={18} />
                        </a>
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center glass rounded-3xl p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Not sure which product fits?
              </h2>
              <p className="text-muted-foreground mb-8">
                Use our loan calculator to estimate repayments, or speak with our team for personalised guidance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="outline" size="lg" asChild>
                  <Link to="/calculator">Try Calculator</Link>
                </Button>
                <Button variant="hero" size="lg" asChild>
                  <a href={borrowerAppPath("/auth?mode=signup")}>
                    Get Started
                    <ArrowRight size={20} />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LoanProducts;
