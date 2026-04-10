import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Banknote, CreditCard, TrendingUp } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import LoanBookReport from "@/components/admin/reports/LoanBookReport";
import CollectionsReport from "@/components/admin/reports/CollectionsReport";
import DisbursementReport from "@/components/admin/reports/DisbursementReport";
import PerformanceReport from "@/components/admin/reports/PerformanceReport";

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports & Export</h1>
          <p className="text-muted-foreground mt-1">Generate, analyze, and export operational reports</p>
          {!canExport && (
            <p className="text-sm text-muted-foreground mt-2">
              You can view reports. Export (PDF/Excel) requires <code className="text-xs">reports:export</code> permission.
            </p>
          )}
        </div>

        <Tabs defaultValue="loan-book" className="space-y-4">
          <TabsList className="bg-muted/50 border border-border/50">
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
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
