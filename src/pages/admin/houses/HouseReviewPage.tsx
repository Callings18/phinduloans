import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";

export default function HouseReviewPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pendingLoans = (loans ?? []).filter((l: any) => l.status === "pending" || l.status === "under_review");

  const stageMutation = useMutation({
    mutationFn: async ({ loanId, stage }: { loanId: string; stage: "loan_officer" | "finance" | "manager" }) => {
      const { error } = await (supabase.rpc as any)("log_audit", {
        p_action: "house_stage_approval",
        p_entity_type: "loan_application",
        p_entity_id: loanId,
        p_metadata: { product_code: productCode, stage },
      });
      if (error) throw error;
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({ status: stage === "manager" ? "approved" : "under_review" })
        .eq("id", loanId);
      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "Review stage recorded" });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Review queue</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {pendingLoans.map((loan: any) => (
          <div key={loan.id} className="rounded border p-3 space-y-2">
            <p className="font-medium">{loan.full_name || loan.email} - K{Number(loan.loan_amount || 0).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "loan_officer" })}>Officer approve</Button>
              <Button size="sm" variant="outline" onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "finance" })}>Finance approve</Button>
              <Button size="sm" onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "manager" })}>Manager approve</Button>
            </div>
          </div>
        ))}
        {pendingLoans.length === 0 && <p className="text-sm text-muted-foreground">No loans waiting review.</p>}
      </CardContent>
    </Card>
  );
}
