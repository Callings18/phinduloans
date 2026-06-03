import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Loader2 } from "lucide-react";
import { useLoanProductModules } from "@/hooks/useLoanProductModules";

export default function AdminHousesIndex() {
  const { data: modules, isLoading } = useLoanProductModules();

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Loan Product Houses"
          description="Each loan product has its own house — open one to run dashboards, borrowers, loans, collections and reports."
          actions={
            <Button asChild variant="outline">
              <Link to="/admin/loan-products">
                <Plus size={16} className="mr-2" />
                Create New Loan Product
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={18} /> Loading houses…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(modules ?? []).filter((m) => m.enabled).map((module) => (
              <Card key={module.productCode} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package size={18} className="text-primary" />
                      <CardTitle className="text-base">{module.name}</CardTitle>
                    </div>
                    {module.isCustom && (
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                    )}
                  </div>
                  {module.description && (
                    <CardDescription className="text-xs line-clamp-2">{module.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Button asChild size="sm">
                    <Link to={`/admin/houses/${module.productCode}`}>Open house</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {(modules ?? []).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No loan products yet. Create one from{" "}
                  <Link to="/admin/loan-products" className="text-primary underline">Loan Products</Link>.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
