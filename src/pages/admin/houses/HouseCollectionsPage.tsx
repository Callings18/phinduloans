import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseRepayments } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { houseMarkRepaymentPaid } from "@/services/repositories/houseWorkflowRepository";

export default function HouseCollectionsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: repayments } = useHouseRepayments(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const overdue = (repayments ?? []).filter((r: any) => r.status !== "paid" && new Date(r.due_date) < new Date());

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => houseMarkRepaymentPaid(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-repayments", productCode] });
      toast({ title: "Repayment marked paid" });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Collections</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {overdue.map((r: any) => (
          <div key={r.id} className="rounded border p-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">Due K{Number(r.amount_due || r.amount || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{r.due_date}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(r.id)}>Mark paid</Button>
          </div>
        ))}
        {overdue.length === 0 && <p className="text-sm text-muted-foreground">No overdue repayments.</p>}
      </CardContent>
    </Card>
  );
}
