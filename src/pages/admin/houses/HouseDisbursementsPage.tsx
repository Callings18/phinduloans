import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useHouseDisbursements } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";

export default function HouseDisbursementsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: disbursements } = useHouseDisbursements(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const disburseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.rpc as any)("house_mark_disbursement_completed", {
        p_disbursement_id: id,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Disbursement action failed");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-disbursements", productCode] });
      toast({ title: "Disbursement marked completed" });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Disbursement queue</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(disbursements ?? []).map((d: any) => (
          <div key={d.id} className="rounded border p-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">K{Number(d.amount || 0).toLocaleString()} - {d.status}</p>
              <p className="text-xs text-muted-foreground">{d.disbursement_method || "N/A"}</p>
            </div>
            {d.status !== "completed" && (
              <Button size="sm" onClick={() => disburseMutation.mutate(d.id)}>Disburse now</Button>
            )}
          </div>
        ))}
        {(disbursements ?? []).length === 0 && <p className="text-sm text-muted-foreground">No disbursements in this house.</p>}
      </CardContent>
    </Card>
  );
}
