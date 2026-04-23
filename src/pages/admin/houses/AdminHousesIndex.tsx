import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LOAN_PRODUCT_MODULES } from "@/config/loanProductModules";

export default function AdminHousesIndex() {
  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Loan Product Houses</h1>
        <p className="text-muted-foreground text-sm">Open an independent product house and run full operations.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {LOAN_PRODUCT_MODULES.filter((m) => m.enabled).map((module) => (
            <Card key={module.code}>
              <CardHeader><CardTitle>{module.name}</CardTitle></CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link to={`/admin/houses/${module.code}`}>Open house</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
