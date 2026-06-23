import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/layout/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { FileText, Banknote, CreditCard, TrendingUp, Send, Download } from "lucide-react";
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
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
