import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { houseSetLoanStatus } from "@/services/repositories/houseWorkflowRepository";

export default function HouseLoanDetailPage() {
  const { productCode = "", loanId = "" } = useParams<{ productCode: string; loanId: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const loan = useMemo(() => (loans ?? []).find((l: any) => l.id === loanId), [loans, loanId]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statusMutation = useMutation({
    mutationFn: (status: string) => houseSetLoanStatus(loanId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "Loan updated" });
    },
  });

  if (!loan) return <p className="text-sm text-muted-foreground">Loan not found.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Loan detail</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <p>Borrower: {loan.full_name || loan.email}</p>
          <p>Amount: K{Number(loan.loan_amount || 0).toLocaleString()}</p>
          <p>Status: {loan.status}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Servicing actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => statusMutation.mutate("approved")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("disbursed")}>Mark disbursed</Button>
          <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("rejected")}>Reject</Button>
        </CardContent>
      </Card>
    </div>
  );
}
