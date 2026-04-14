import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams } from "react-router-dom";
import { useHouseReportSummary } from "@/hooks/useHouseData";

export default function HouseDashboardPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data } = useHouseReportSummary(productCode);

  const cards = [
    { label: "Total loans", value: data?.totalLoans ?? 0 },
    { label: "Active loans", value: data?.activeLoans ?? 0 },
    { label: "Overdue items", value: data?.overdue ?? 0 },
    { label: "Total disbursed", value: `K${Number(data?.totalDisbursed ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{c.label}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{c.value}</p></CardContent>
        </Card>
      ))}
    </div>
  );
}
