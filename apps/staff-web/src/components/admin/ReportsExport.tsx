import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { Label } from "@phinduloans/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ReportsExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReportType = "loans" | "repayments" | "collections" | "disbursements" | "portfolio";

export default function ReportsExport({ open, onOpenChange }: ReportsExportProps) {
  const { can } = usePermissions();
  const canExport = can("reports", "export");
  const [reportType, setReportType] = useState<ReportType>("loans");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "xlsx">("csv");
  const [dateRange, setDateRange] = useState("all");
  const [includeFields, setIncludeFields] = useState({
    personalInfo: true,
    financials: true,
    status: true,
    dates: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let data: any[] = [];
      let columns: string[] = [];
      let title = "";
      let extraSheetData: any[] | null = null;
      let extraSheetName = "";

      // Fetch data based on report type
      if (reportType === "loans") {
        const { data: loans, error } = await supabase
          .from("loan_applications")
          .select("*")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        data = (loans || []).map(loan => ({
          "Loan ID": loan.id.slice(0, 8),
          "Borrower": loan.full_name,
          "Phone": includeFields.personalInfo ? loan.phone : "***",
          "Email": includeFields.personalInfo ? loan.email : "***",
          "Amount": `K${Number(loan.loan_amount).toLocaleString()}`,
          "Term": `${loan.loan_term_months} months`,
          "Interest Rate": `${loan.interest_rate}%`,
          "Total Repayment": `K${Number(loan.total_repayment || 0).toLocaleString()}`,
          "Status": loan.status,
          "Applied Date": format(new Date(loan.created_at), "yyyy-MM-dd"),
        }));
        columns = Object.keys(data[0] || {});
        title = "Loan Applications Report";
      } else if (reportType === "repayments") {
        const { data: repayments, error } = await supabase
          .from("loan_repayments")
          .select(`*, loan:loan_id (full_name, phone)`)
          .order("due_date", { ascending: false });
        
        if (error) throw error;
        
        data = (repayments || []).map(rep => ({
          "Repayment ID": rep.id.slice(0, 8),
          "Borrower": rep.loan?.full_name || "N/A",
          "Amount Due": `K${Number(rep.amount).toLocaleString()}`,
          "Penalty": `K${Number(rep.penalty_amount || 0).toLocaleString()}`,
          "Due Date": format(new Date(rep.due_date), "yyyy-MM-dd"),
          "Paid Date": rep.paid_date ? format(new Date(rep.paid_date), "yyyy-MM-dd") : "-",
          "Status": rep.status,
          "Payment Method": rep.payment_method || "-",
        }));
        columns = Object.keys(data[0] || {});
        title = "Repayments Report";
      } else if (reportType === "collections") {
        const { data: activities, error } = await supabase
          .from("collection_activities")
          .select(`*, loan:loan_id (full_name, phone)`)
          .order("created_at", { ascending: false })
          .limit(500);
        
        if (error) throw error;
        
        data = (activities || []).map(act => ({
          "Date": format(new Date(act.created_at), "yyyy-MM-dd HH:mm"),
          "Borrower": act.loan?.full_name || "N/A",
          "Activity Type": act.activity_type,
          "Outcome": act.outcome || "-",
          "Promise Date": act.promise_date ? format(new Date(act.promise_date), "yyyy-MM-dd") : "-",
          "Promise Amount": act.promise_amount ? `K${Number(act.promise_amount).toLocaleString()}` : "-",
          "Escalation Level": act.escalation_level || "-",
          "Notes": (act.notes || "").slice(0, 50) + "...",
        }));
        columns = Object.keys(data[0] || {});
        title = "Collections Activity Report";
      } else if (reportType === "disbursements") {
        const { data: disbursements, error } = await supabase
          .from("disbursements")
          .select(`*, loan:loan_id (full_name, phone)`)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        data = (disbursements || []).map(dis => ({
          "Reference": dis.transaction_reference || dis.id.slice(0, 8),
          "Borrower": dis.loan?.full_name || "N/A",
          "Amount": `K${Number(dis.amount).toLocaleString()}`,
          "Method": dis.disbursement_method,
          "Account/Mobile": dis.account_number || dis.mobile_money_number || "-",
          "Status": dis.status,
          "Created": format(new Date(dis.created_at), "yyyy-MM-dd"),
          "Disbursed": dis.disbursed_at ? format(new Date(dis.disbursed_at), "yyyy-MM-dd") : "-",
        }));
        columns = Object.keys(data[0] || {});
        title = "Disbursements Report";
      } else if (reportType === "portfolio") {
        // Portfolio summary
        const { data: loans } = await supabase.from("loan_applications").select("*");
        const { data: repayments } = await supabase.from("loan_repayments").select("*");
        
        const allLoans = loans || [];
        const allReps = repayments || [];
        
        const totalDisbursed = allLoans.filter(l => ["disbursed", "active", "completed"].includes(l.status))
          .reduce((sum, l) => sum + Number(l.loan_amount), 0);
        const totalExpectedRepayment = allLoans.filter(l => ["disbursed", "active", "completed"].includes(l.status))
          .reduce((sum, l) => sum + Number(l.total_repayment || 0), 0);
        const totalCollected = allReps.filter(r => r.status === "paid")
          .reduce((sum, r) => sum + Number(r.amount), 0);
        const totalOverdue = allReps.filter(r => r.status === "pending" && new Date(r.due_date) < new Date())
          .reduce((sum, r) => sum + Number(r.amount), 0);
        
        data = [
          { "Metric": "Total Loans", "Value": allLoans.length.toString() },
          { "Metric": "Active Loans", "Value": allLoans.filter(l => ["disbursed", "active"].includes(l.status)).length.toString() },
          { "Metric": "Completed Loans", "Value": allLoans.filter(l => l.status === "completed").length.toString() },
          { "Metric": "Defaulted Loans", "Value": allLoans.filter(l => l.status === "defaulted").length.toString() },
          { "Metric": "Total Disbursed", "Value": `K${totalDisbursed.toLocaleString()}` },
          { "Metric": "Expected Repayment", "Value": `K${totalExpectedRepayment.toLocaleString()}` },
          { "Metric": "Total Collected", "Value": `K${totalCollected.toLocaleString()}` },
          { "Metric": "Total Overdue", "Value": `K${totalOverdue.toLocaleString()}` },
          { "Metric": "Collection Rate", "Value": `${totalExpectedRepayment > 0 ? ((totalCollected / totalExpectedRepayment) * 100).toFixed(1) : 0}%` },
          { "Metric": "PAR (Portfolio at Risk)", "Value": `${totalDisbursed > 0 ? ((totalOverdue / totalDisbursed) * 100).toFixed(1) : 0}%` },
        ];
        columns = ["Metric", "Value"];
        title = "Portfolio Summary Report";
        if (exportFormat === "xlsx") {
          extraSheetData = allLoans
            .filter(l => ["disbursed", "active", "completed"].includes(l.status))
            .map(l => ({
              "Loan ID": l.id?.slice(0, 8) || "",
              "Borrower": l.full_name,
              "Amount (K)": Number(l.loan_amount),
              "Total Repayment (K)": Number(l.total_repayment || 0),
              "Status": l.status,
              "Applied": format(new Date(l.created_at), "yyyy-MM-dd"),
            }));
          extraSheetName = "Active & Completed Loans";
        }
      }

      if (data.length === 0) {
        toast.error("No data to export");
        return;
      }

      if (exportFormat === "csv") {
        const csvContent = [
          columns.join(","),
          ...data.map(row => columns.map(col => `"${row[col] || ""}"`).join(","))
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (exportFormat === "xlsx") {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, reportType === "portfolio" ? "Summary" : "Report");
        if (extraSheetData && extraSheetData.length > 0 && extraSheetName) {
          const ws2 = XLSX.utils.json_to_sheet(extraSheetData);
          XLSX.utils.book_append_sheet(wb, ws2, extraSheetName.slice(0, 31));
        }
        XLSX.writeFile(wb, `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      } else {
        // Generate PDF
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(title, 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy HH:mm")}`, 14, 30);
        doc.text(`Phindu Finance - Confidential`, 14, 35);
        
        // Table
        autoTable(doc, {
          head: [columns],
          body: data.map(row => columns.map(col => row[col] || "")),
          startY: 42,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        });

        doc.save(`${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      }

      toast.success(`${title} exported successfully`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download size={20} /> Export Reports
          </DialogTitle>
          <DialogDescription>
            Generate and download detailed reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loans">Loan Applications</SelectItem>
                <SelectItem value="repayments">Repayments</SelectItem>
                <SelectItem value="collections">Collections Activity</SelectItem>
                <SelectItem value="disbursements">Disbursements</SelectItem>
                <SelectItem value="portfolio">Portfolio Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={(v: "csv" | "pdf" | "xlsx") => setExportFormat(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={14} /> CSV
                  </div>
                </SelectItem>
                <SelectItem value="xlsx">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={14} /> Excel (.xlsx)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText size={14} /> PDF Document
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Include in Export</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="personalInfo"
                  checked={includeFields.personalInfo}
                  onCheckedChange={(checked) => setIncludeFields(prev => ({ ...prev, personalInfo: !!checked }))}
                />
                <label htmlFor="personalInfo" className="text-sm">Personal Information (Phone, Email)</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="financials"
                  checked={includeFields.financials}
                  onCheckedChange={(checked) => setIncludeFields(prev => ({ ...prev, financials: !!checked }))}
                />
                <label htmlFor="financials" className="text-sm">Financial Details</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status"
                  checked={includeFields.status}
                  onCheckedChange={(checked) => setIncludeFields(prev => ({ ...prev, status: !!checked }))}
                />
                <label htmlFor="status" className="text-sm">Status Information</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dates"
                  checked={includeFields.dates}
                  onCheckedChange={(checked) => setIncludeFields(prev => ({ ...prev, dates: !!checked }))}
                />
                <label htmlFor="dates" className="text-sm">Date Fields</label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !canExport} title={!canExport ? "You don't have permission to export reports." : undefined}>
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={14} className="mr-2" />
                Export Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
