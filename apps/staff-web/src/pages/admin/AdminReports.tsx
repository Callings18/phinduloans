import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/layout/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { FileText, Banknote, CreditCard, TrendingUp, Send, Download, RotateCcw, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import LoanBookReport from "@/components/admin/reports/LoanBookReport";
import CollectionsReport from "@/components/admin/reports/CollectionsReport";
import DisbursementReport from "@/components/admin/reports/DisbursementReport";
import PerformanceReport from "@/components/admin/reports/PerformanceReport";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { format } from "date-fns";

const AdminReports = () => {
  const { can } = usePermissions();
  const canExport = can("reports", "export");

  // Shared data: products and officers used across tabs
  const { data: products = [] } = useQuery({
    queryKey: ["reports-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_products").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["reports-officers"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase.from("user_roles").select("user_id").neq("role", "user").neq("role", "employer");
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];
      const ids = roles.map((r: { user_id: string }) => r.user_id);
      const { data: profiles, error: profErr } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (profErr) throw profErr;
      return (profiles ?? []) as { id: string; full_name: string | null }[];
    },
  });

  const { data: housePostedReports = [] } = useQuery({
    queryKey: ["reports-house-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("product_house_report_posts")
        .select("id, product_code, product_name, report_type, csv_content, created_at, poster:profiles!product_house_report_posts_posted_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        product_code: string;
        product_name: string | null;
        report_type: string;
        csv_content: string | null;
        created_at: string;
        poster?: { full_name?: string | null } | null;
      }>;
    },
  });

  const { data: loanAdjustments = [], isLoading: adjustmentsLoading } = useQuery({
    queryKey: ["loan-adjustment-audit"],
    queryFn: async () => {
      const allRows: Array<{ id: string; action: string; entity_id: string; details: Record<string, unknown> | null; created_at: string }> = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from("audit_logs")
          .select("id, action, entity_id, details, created_at")
          .in("action", ["LOAN_DELETED", "UNDO_DISBURSEMENT"])
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...((data ?? []) as typeof allRows));
        if (!data || data.length < pageSize) return allRows;
      }
    },
  });

  const adjustmentTotals = loanAdjustments.reduce((totals, row) => {
    const details = row.details ?? {};
    if (row.action === "UNDO_DISBURSEMENT") {
      totals.undone += 1;
      totals.refunded += Number(details.refunded_amount ?? 0);
      totals.grossUndone += Number(details.gross_disbursed_amount ?? 0);
      totals.scheduleRemoved += Number(details.scheduled_amount_removed ?? 0);
    } else {
      totals.deleted += 1;
      totals.deletedLoanAmount += Number(details.loan_amount ?? 0);
    }
    return totals;
  }, { undone: 0, refunded: 0, grossUndone: 0, scheduleRemoved: 0, deleted: 0, deletedLoanAmount: 0 });

  const downloadAdjustmentsCsv = () => {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Action", "Loan ID", "Borrower", "Previous status", "Loan amount", "Gross disbursed", "Refunded", "Scheduled amount removed"],
      ...loanAdjustments.map((row) => {
        const d = row.details ?? {};
        return [row.created_at, row.action, row.entity_id, d.borrower_name, d.previous_status,
          d.loan_amount, d.gross_disbursed_amount, d.refunded_amount, d.scheduled_amount_removed];
      }),
    ];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `loan-adjustments-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const downloadPostedCsv = (row: { product_code: string; csv_content: string | null; created_at: string }) => {
    if (!row.csv_content) return;
    const blob = new Blob([row.csv_content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.product_code.toLowerCase()}-posted-report-${format(new Date(row.created_at), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Reports & Export"
          description={
            <>
              Generate, analyze, and export operational reports
              {!canExport && (
                <span className="mt-2 block text-sm">
                  You can view reports. Export (PDF/Excel) requires{" "}
                  <code className="text-xs">reports:export</code> permission.
                </span>
              )}
            </>
          }
        />

        <Tabs defaultValue="loan-book" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto bg-muted/50 border border-border/50 p-1">
            <TabsTrigger value="loan-book" className="gap-2 data-[state=active]:bg-card">
              <FileText size={14} /> Loan Book
            </TabsTrigger>
            <TabsTrigger value="collections" className="gap-2 data-[state=active]:bg-card">
              <Banknote size={14} /> Collections
            </TabsTrigger>
            <TabsTrigger value="disbursements" className="gap-2 data-[state=active]:bg-card">
              <CreditCard size={14} /> Disbursements
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2 data-[state=active]:bg-card">
              <TrendingUp size={14} /> Performance
            </TabsTrigger>
            <TabsTrigger value="house-posts" className="gap-2 data-[state=active]:bg-card">
              <Send size={14} /> House Posts
            </TabsTrigger>
            <TabsTrigger value="loan-adjustments" className="gap-2 data-[state=active]:bg-card">
              <RotateCcw size={14} /> Loan Adjustments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loan-book">
            <LoanBookReport products={products} officers={officers} canExport={canExport} />
          </TabsContent>
          <TabsContent value="collections">
            <CollectionsReport products={products} canExport={canExport} />
          </TabsContent>
          <TabsContent value="disbursements">
            <DisbursementReport products={products} officers={officers} canExport={canExport} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceReport officers={officers} canExport={canExport} />
          </TabsContent>
          <TabsContent value="house-posts">
            <Card>
              <CardHeader>
                <CardTitle>Product house posted reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {housePostedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No posted house reports yet.</p>
                ) : (
                  housePostedReports.map((row) => (
                    <div key={row.id} className="rounded border p-3 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {row.product_name || row.product_code} <span className="text-xs text-muted-foreground">({row.report_type})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")} · posted by {row.poster?.full_name || "Unknown"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!row.csv_content}
                        onClick={() => downloadPostedCsv(row)}
                      >
                        <Download size={14} className="mr-1" />
                        Download CSV
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="loan-adjustments">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Loans deleted", adjustmentTotals.deleted.toLocaleString()],
                  ["Disbursements undone", adjustmentTotals.undone.toLocaleString()],
                  ["Gross disbursement reversed", `K${adjustmentTotals.grossUndone.toLocaleString()}`],
                  ["Funds refunded", `K${adjustmentTotals.refunded.toLocaleString()}`],
                  ["Deleted loan value", `K${adjustmentTotals.deletedLoanAmount.toLocaleString()}`],
                  ["Schedule removed", `K${adjustmentTotals.scheduleRemoved.toLocaleString()}`],
                ].map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{value}</CardContent></Card>)}
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div><CardTitle>Deleted and reversed loans</CardTitle><p className="mt-1 text-sm text-muted-foreground">Append-only audit history, including amounts refunded and repayment schedules removed.</p></div>
                  <Button variant="outline" size="sm" onClick={downloadAdjustmentsCsv} disabled={!loanAdjustments.length}><Download size={14} className="mr-2" />Export CSV</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {adjustmentsLoading ? <p className="text-sm text-muted-foreground">Loading adjustment history…</p> : loanAdjustments.length === 0 ? <p className="text-sm text-muted-foreground">No loan deletions or disbursement reversals recorded.</p> : loanAdjustments.map((row) => {
                    const d = row.details ?? {};
                    const undone = row.action === "UNDO_DISBURSEMENT";
                    return <div key={row.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="flex items-start gap-3"><span className="mt-0.5 text-muted-foreground">{undone ? <RotateCcw size={16} /> : <Trash2 size={16} />}</span><div><p className="font-medium">{undone ? "Disbursement undone" : "Loan deleted"} · {String(d.borrower_name || "Borrower")}</p><p className="text-xs text-muted-foreground">{format(new Date(row.created_at), "dd MMM yyyy HH:mm")} · loan {row.entity_id} · previous status: {String(d.previous_status || "unknown")}</p></div></div>
                      <div className="text-sm sm:text-right"><p>Loan value: K{Number(d.loan_amount ?? 0).toLocaleString()} · Disbursed: K{Number(d.gross_disbursed_amount ?? 0).toLocaleString()}</p><p>Refunded: <strong>K{Number(d.refunded_amount ?? 0).toLocaleString()}</strong> · Recovered: K{Number(d.amount_recovered ?? 0).toLocaleString()}</p><p className="text-muted-foreground">Schedule removed: K{Number(d.scheduled_amount_removed ?? 0).toLocaleString()}</p></div>
                    </div>;
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
