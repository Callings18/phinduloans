import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, AlertTriangle, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isPast, addDays } from "date-fns";
import { BetaBadge } from "@/components/admin/BetaBadge";

interface MarketeerLoan {
  id: string;
  full_name: string;
  phone: string;
  loan_amount: number;
  total_repayment: number;
  monthly_payment: number; // daily repayment amount
  loan_term_months: number; // days
  status: string;
  product_specific_data: any;
  created_at: string;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  status: string;
  principal_paid: number | null;
  installment_number: number;
}

export default function MarketeerDailyCollectionTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  const { data: loans = [] } = useQuery({
    queryKey: ["marketeer-active-loans"],
    queryFn: async () => {
      const { data: product } = await supabase
        .from("loan_products")
        .select("id")
        .eq("product_code", "MARKETEER")
        .maybeSingle();
      if (!product) return [];
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, full_name, phone, loan_amount, total_repayment, monthly_payment, loan_term_months, status, product_specific_data, created_at")
        .eq("loan_product_id", product.id)
        .in("status", ["active", "disbursed", "approved"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketeerLoan[];
    },
  });

  const loanIds = useMemo(() => loans.map((l) => l.id), [loans]);

  const { data: repayments = [] } = useQuery({
    queryKey: ["marketeer-repayments", loanIds],
    enabled: loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, loan_id, amount, due_date, status, principal_paid, installment_number")
        .in("loan_id", loanIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Repayment[];
    },
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const loanSummaries = useMemo(() => {
    return loans.map((loan) => {
      const loanRepayments = repayments.filter((r) => r.loan_id === loan.id);
      const paid = loanRepayments.filter((r) => r.status === "paid");
      const totalPaid = paid.reduce((s, r) => s + Number(r.principal_paid || r.amount), 0);
      const outstanding = Number(loan.total_repayment) - totalPaid;
      const todayDue = loanRepayments.find(
        (r) => r.due_date === todayStr && r.status !== "paid"
      );
      const overdue = loanRepayments.filter(
        (r) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== todayStr
      );
      const dailyAmount = Number(loan.monthly_payment || loan.product_specific_data?.dailyRepayment || 0);
      const daysLeft = loanRepayments.filter((r) => r.status !== "paid" && r.status !== "cancelled").length;

      return {
        ...loan,
        totalPaid,
        outstanding: Math.max(outstanding, 0),
        todayDue,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s, r) => s + Number(r.amount), 0),
        dailyAmount,
        daysLeft,
        paidDays: paid.length,
        totalDays: loanRepayments.length,
      };
    });
  }, [loans, repayments, todayStr]);

  const recordPayment = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      const { error } = await supabase
        .from("loan_repayments")
        .update({ status: "paid", principal_paid: amount, paid_at: new Date().toISOString() })
        .eq("id", repaymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketeer-repayments"] });
      queryClient.invalidateQueries({ queryKey: ["marketeer-active-loans"] });
      toast({ title: "Payment recorded", description: "Daily collection marked as paid." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const totalDueToday = loanSummaries.reduce(
    (s, l) => s + (l.todayDue ? Number(l.todayDue.amount) : 0), 0
  );
  const totalOverdue = loanSummaries.reduce((s, l) => s + l.overdueAmount, 0);
  const totalOutstanding = loanSummaries.reduce((s, l) => s + l.outstanding, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Daily Collection Tracker</h2>
        <BetaBadge />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Due today</p>
              <p className="text-lg font-bold">K{totalDueToday.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Total overdue</p>
              <p className="text-lg font-bold text-destructive">K{totalOverdue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">K{totalOutstanding.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Active marketeer loans</p>
              <p className="text-lg font-bold">{loans.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's collections — {format(new Date(), "EEEE, dd MMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Daily amt</TableHead>
                <TableHead className="text-right">Paid / Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Today</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loanSummaries.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.full_name}</TableCell>
                  <TableCell className="text-sm">{loan.phone}</TableCell>
                  <TableCell className="text-right">K{Number(loan.loan_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right">K{loan.dailyAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-green-600">{loan.paidDays}</span>
                    <span className="text-muted-foreground">/{loan.totalDays}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">K{loan.outstanding.toLocaleString()}</TableCell>
                  <TableCell>
                    {loan.overdueCount > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {loan.overdueCount} day{loan.overdueCount > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">On track</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {loan.todayDue ? (
                      <Badge variant="secondary" className="text-xs">
                        K{Number(loan.todayDue.amount).toLocaleString()} due
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {loan.todayDue ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder={String(loan.todayDue.amount)}
                          className="w-20 h-7 text-xs"
                          value={payAmounts[loan.todayDue.id] ?? ""}
                          onChange={(e) =>
                            setPayAmounts((p) => ({ ...p, [loan.todayDue!.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          disabled={recordPayment.isPending}
                          onClick={() =>
                            recordPayment.mutate({
                              repaymentId: loan.todayDue!.id,
                              amount: Number(payAmounts[loan.todayDue!.id] || loan.todayDue!.amount),
                            })
                          }
                        >
                          Pay
                        </Button>
                      </div>
                    ) : loan.status === "approved" ? (
                      <Badge variant="outline" className="text-xs">Awaiting disbursement</Badge>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {loanSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No active marketeer loans found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
