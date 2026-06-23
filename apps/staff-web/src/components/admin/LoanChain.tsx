import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Skeleton } from "@phinduloans/shared/components/ui/skeleton";
import { ArrowRight, Eye, Link2 } from "lucide-react";

interface LoanChainProps {
  loanId: string;
  parentLoanId?: string | null;
  onViewLoan?: (loanId: string) => void;
}

interface ChainLoan {
  id: string;
  loan_amount: number;
  total_repayment: number;
  interest_rate: number;
  loan_term_months: number;
  status: string;
  created_at: string;
  parent_loan_id: string | null;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  disbursed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  defaulted: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LoanChain({ loanId, parentLoanId, onViewLoan }: LoanChainProps) {
  // Find the root loan by traversing up
  const { data: chainLoans, isLoading } = useQuery({
    queryKey: ["loan-chain", loanId],
    queryFn: async () => {
      // Get all loans for this borrower that are linked
      // Strategy: find root, then traverse forward
      const loans: ChainLoan[] = [];

      // First get current loan
      const { data: currentLoan } = await supabase
        .from("loan_applications")
        .select("id, loan_amount, total_repayment, interest_rate, loan_term_months, status, created_at, parent_loan_id, full_name, user_id")
        .eq("id", loanId)
        .single();

      if (!currentLoan) return [];

      // Traverse up to find root
      let rootId = currentLoan.id;
      let currentParent = (currentLoan as any).parent_loan_id;
      const visited = new Set<string>([rootId]);

      while (currentParent && !visited.has(currentParent)) {
        visited.add(currentParent);
        const { data: parentLoan } = await supabase
          .from("loan_applications")
          .select("id, loan_amount, total_repayment, interest_rate, loan_term_months, status, created_at, parent_loan_id, full_name")
          .eq("id", currentParent)
          .single();
        if (parentLoan) {
          rootId = parentLoan.id;
          currentParent = (parentLoan as any).parent_loan_id;
        } else {
          break;
        }
      }

      // Now get all loans in the chain starting from root (using user_id and parent references)
      const { data: allRelated } = await supabase
        .from("loan_applications")
        .select("id, loan_amount, total_repayment, interest_rate, loan_term_months, status, created_at, parent_loan_id, full_name")
        .eq("user_id", currentLoan.user_id)
        .order("created_at", { ascending: true });

      if (!allRelated) return [];

      // Build the chain by following parent_loan_id references
      const chainMap = new Map<string | null, ChainLoan[]>();
      for (const loan of allRelated) {
        const parentId = (loan as any).parent_loan_id;
        if (!chainMap.has(parentId)) chainMap.set(parentId, []);
        chainMap.get(parentId)!.push(loan as any);
      }

      // Traverse from root
      const buildChain = (parentId: string | null): ChainLoan[] => {
        const children = chainMap.get(parentId) || [];
        const result: ChainLoan[] = [];
        for (const child of children) {
          result.push(child);
          result.push(...buildChain(child.id));
        }
        return result;
      };

      // Start from the root (null parent or the root we found)
      const rootLoans = chainMap.get(null) || [];
      const rootLoan = rootLoans.find((l) => l.id === rootId) || rootLoans[0];
      
      if (rootLoan) {
        loans.push(rootLoan);
        loans.push(...buildChain(rootLoan.id));
      }

      // If no chain found, just return the current loan
      if (loans.length === 0) {
        loans.push(currentLoan as any);
      }

      return loans;
    },
    enabled: !!loanId,
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!chainLoans || chainLoans.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Link2 size={14} />
        <span>This is a standalone loan — no chain history.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Link2 size={14} />
        <span>Loan chain: {chainLoans.length} loans</span>
      </div>

      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {chainLoans.map((loan, idx) => {
          const isCurrent = loan.id === loanId;
          const statusColor = STATUS_COLORS[loan.status] || STATUS_COLORS.pending;

          return (
            <div key={loan.id} className="flex items-center shrink-0">
              {/* Loan card */}
              <div
                className={`rounded-lg border p-3 min-w-[180px] transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/50 bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    #{loan.id.slice(0, 8).toUpperCase()}
                  </span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColor}`}>
                    {loan.status}
                  </Badge>
                </div>
                <div className="text-sm font-semibold">
                  {formatCurrency(loan.loan_amount)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {loan.loan_term_months}mo @ {loan.interest_rate}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {format(new Date(loan.created_at), "dd MMM yyyy")}
                </div>
                {!isCurrent && onViewLoan && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 mt-1 text-[10px]"
                    onClick={() => onViewLoan(loan.id)}
                  >
                    <Eye size={10} className="mr-1" /> View
                  </Button>
                )}
                {isCurrent && (
                  <span className="text-[10px] text-primary font-medium mt-1 block">← Current</span>
                )}
              </div>

              {/* Arrow connector */}
              {idx < chainLoans.length - 1 && (
                <ArrowRight size={16} className="mx-1 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
