import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHouseBorrowers } from "@/hooks/useHouseData";

export default function HouseBorrowersPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: borrowers } = useHouseBorrowers(productCode);

  return (
    <Card>
      <CardHeader><CardTitle>Borrowers</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(borrowers ?? []).map((b: any) => (
          <div key={b.id} className="rounded border p-3">
            <p className="font-medium">{b.full_name || b.email}</p>
            <p className="text-sm text-muted-foreground">{b.phone || "No phone"} - {b.city || "No city"}</p>
          </div>
        ))}
        {(borrowers ?? []).length === 0 && <p className="text-sm text-muted-foreground">No borrowers for this product yet.</p>}
      </CardContent>
    </Card>
  );
}
