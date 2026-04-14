import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseLoans } from "@/hooks/useHouseData";

export default function HouseLoansPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans } = useHouseLoans(productCode);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Loans</CardTitle>
        <Button asChild size="sm"><Link to={`/admin/houses/${productCode}/loans/create`}>Create loan</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {(loans ?? []).map((loan: any) => (
          <Link key={loan.id} to={`/admin/houses/${productCode}/loans/${loan.id}`} className="block rounded border p-3 hover:bg-muted/40">
            <p className="font-medium">K{Number(loan.loan_amount || 0).toLocaleString()} - {loan.status}</p>
            <p className="text-xs text-muted-foreground">{loan.full_name || loan.email}</p>
          </Link>
        ))}
        {(loans ?? []).length === 0 && <p className="text-sm text-muted-foreground">No loans available.</p>}
      </CardContent>
    </Card>
  );
}
