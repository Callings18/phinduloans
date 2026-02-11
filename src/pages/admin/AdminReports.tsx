import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Banknote, CreditCard, TrendingUp } from "lucide-react";
import LoanBookReport from "@/components/admin/reports/LoanBookReport";
import CollectionsReport from "@/components/admin/reports/CollectionsReport";
import DisbursementReport from "@/components/admin/reports/DisbursementReport";
import PerformanceReport from "@/components/admin/reports/PerformanceReport";

const AdminReports = () => {
  // Shared data: products and officers used across tabs
  const { data: products = [] } = useQuery({
    queryKey: ["reports-products"],
    queryFn: async () => {
      const { data } = await supabase.from("loan_products").select("id, name").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["reports-officers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").neq("role", "user").neq("role", "employer");
      if (!roles?.length) return [];
      const ids = roles.map((r: { user_id: string }) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profiles ?? []) as { id: string; full_name: string | null }[];
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports & Export</h1>
          <p className="text-muted-foreground mt-1">Generate, analyze, and export operational reports</p>
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
            <LoanBookReport products={products} officers={officers} />
          </TabsContent>
          <TabsContent value="collections">
            <CollectionsReport products={products} />
          </TabsContent>
          <TabsContent value="disbursements">
            <DisbursementReport products={products} officers={officers} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceReport officers={officers} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
