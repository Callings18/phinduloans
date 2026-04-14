import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHouseBorrowers, useHouseLoans } from "@/hooks/useHouseData";

export default function HouseBorrowerDetailPage() {
  const { productCode = "", borrowerId = "" } = useParams<{ productCode: string; borrowerId: string }>();
  const { data: borrowers } = useHouseBorrowers(productCode);
  const { data: loans } = useHouseLoans(productCode);
  const borrower = (borrowers ?? []).find((b: any) => b.id === borrowerId);
  const borrowerLoans = (loans ?? []).filter((l: any) => l.user_id === borrowerId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{borrower?.full_name || borrower?.email || "Borrower profile"}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{borrower?.phone || "No phone"} | {borrower?.city || "No city"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Loans in this house</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {borrowerLoans.map((loan: any) => (
            <div key={loan.id} className="rounded border p-3">
              <p className="font-medium">K{Number(loan.loan_amount || 0).toLocaleString()} - {loan.status}</p>
            </div>
          ))}
          {borrowerLoans.length === 0 && <p className="text-sm text-muted-foreground">No house loans found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
