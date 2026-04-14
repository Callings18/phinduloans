import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseReportSummary } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";

export default function HouseReportsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data } = useHouseReportSummary(productCode);
  const { toast } = useToast();

  const exportCsv = () => {
    const lines = [
      "metric,value",
      `total_loans,${data?.totalLoans ?? 0}`,
      `active_loans,${data?.activeLoans ?? 0}`,
      `overdue_items,${data?.overdue ?? 0}`,
      `total_disbursed,${data?.totalDisbursed ?? 0}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productCode.toLowerCase()}-house-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report export generated" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>House reports</CardTitle>
        <Button size="sm" onClick={exportCsv}>Export CSV</Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Total loans: {data?.totalLoans ?? 0}</p>
        <p>Active loans: {data?.activeLoans ?? 0}</p>
        <p>Overdue items: {data?.overdue ?? 0}</p>
        <p>Total disbursed: K{Number(data?.totalDisbursed ?? 0).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
