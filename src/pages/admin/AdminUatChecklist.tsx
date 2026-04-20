/**
 * AdminUatChecklist — in-app per-house UAT sign-off tracker.
 * Replaces ticking boxes in docs/LAUNCH_MATRIX_UAT.md with a DB-backed view
 * so signoffs are auditable and visible to the whole team.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const HOUSES = [
  { code: "SALARY_ADVANCE", label: "Salary Advance" },
  { code: "SALARY_ADVANCE_STAFF", label: "Staff Salary Advance" },
  { code: "BUSINESS", label: "Business" },
  { code: "COLLATERAL", label: "Collateral" },
  { code: "PAYDAY_SOFT", label: "Payday Soft" },
  { code: "MARKETEER", label: "Marketeer" },
];

const CHECKLIST: { category: string; item: string }[] = [
  { category: "Application", item: "Borrower can submit a new application end-to-end" },
  { category: "Application", item: "Required documents upload + replace works" },
  { category: "Review", item: "Loan officer can review and recommend" },
  { category: "Review", item: "Finance officer can approve" },
  { category: "Review", item: "Manager / admin can give final approval" },
  { category: "Disbursement", item: "Disbursement debits correct funding account" },
  { category: "Disbursement", item: "Schedule auto-generates after disbursement" },
  { category: "Borrower comms", item: "Borrower receives SMS on approval" },
  { category: "Borrower comms", item: "Borrower receives email on approval" },
  { category: "Repayments", item: "Recording a repayment credits the account" },
  { category: "Repayments", item: "Receipt PDF can be downloaded by borrower" },
  { category: "Repayments", item: "Bulk repayment upload works" },
  { category: "Collections", item: "Overdue loan appears in collections queue" },
  { category: "Collections", item: "Promise-to-pay can be logged" },
  { category: "Reports", item: "House dashboard shows correct totals" },
  { category: "Reports", item: "CSV/PDF export works for the house" },
];

interface SignoffRow {
  id: string;
  house_code: string;
  checklist_item: string;
  category: string;
  is_signed_off: boolean;
  signed_off_by: string | null;
  signed_off_at: string | null;
  notes: string | null;
}

const AdminUatChecklist = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeHouse, setActiveHouse] = useState(HOUSES[0].code);

  const { data: signoffs, isLoading } = useQuery({
    queryKey: ["uat-signoffs"],
    queryFn: async (): Promise<SignoffRow[]> => {
      const { data, error } = await supabase.from("uat_signoffs").select("*");
      if (error) throw error;
      return (data ?? []) as SignoffRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      house,
      item,
      category,
      next,
    }: {
      house: string;
      item: string;
      category: string;
      next: boolean;
    }) => {
      const existing = signoffs?.find((s) => s.house_code === house && s.checklist_item === item);
      if (existing) {
        const { error } = await supabase
          .from("uat_signoffs")
          .update({
            is_signed_off: next,
            signed_off_by: next ? user?.id ?? null : null,
            signed_off_at: next ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("uat_signoffs").insert({
          house_code: house,
          checklist_item: item,
          category,
          is_signed_off: next,
          signed_off_by: next ? user?.id ?? null : null,
          signed_off_at: next ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["uat-signoffs"] }),
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const houseSignoffs = useMemo(
    () => (signoffs ?? []).filter((s) => s.house_code === activeHouse),
    [signoffs, activeHouse],
  );

  const houseProgress = useMemo(() => {
    return HOUSES.map((h) => {
      const rows = (signoffs ?? []).filter((s) => s.house_code === h.code && s.is_signed_off);
      return { code: h.code, label: h.label, signed: rows.length, total: CHECKLIST.length };
    });
  }, [signoffs]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof CHECKLIST>();
    CHECKLIST.forEach((c) => {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">UAT sign-off</h1>
          <p className="text-muted-foreground mt-1">
            Per-house acceptance checklist. Tick items as you verify them; signoffs are saved to the audit trail.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {houseProgress.map((h) => {
            const pct = Math.round((h.signed / h.total) * 100);
            return (
              <Card key={h.code} className={activeHouse === h.code ? "border-primary" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{h.label}</p>
                    <Badge variant={pct === 100 ? "default" : "outline"}>
                      {h.signed}/{h.total}
                    </Badge>
                  </div>
                  <Progress value={pct} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeHouse} onValueChange={setActiveHouse}>
          <TabsList className="flex-wrap h-auto">
            {HOUSES.map((h) => (
              <TabsTrigger key={h.code} value={h.code}>
                {h.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {HOUSES.map((h) => (
            <TabsContent key={h.code} value={h.code} className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                grouped.map(([category, items]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category}</CardTitle>
                      <CardDescription>{items.length} check(s)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {items.map((c) => {
                        const row = houseSignoffs.find((s) => s.checklist_item === c.item);
                        const isSigned = row?.is_signed_off ?? false;
                        return (
                          <label
                            key={c.item}
                            className="flex items-start gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                          >
                            <Checkbox
                              checked={isSigned}
                              disabled={toggle.isPending}
                              onCheckedChange={(next) =>
                                toggle.mutate({
                                  house: h.code,
                                  item: c.item,
                                  category: c.category,
                                  next: Boolean(next),
                                })
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${isSigned ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {c.item}
                              </p>
                              {isSigned && row?.signed_off_at && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Signed off {new Date(row.signed_off_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminUatChecklist;
