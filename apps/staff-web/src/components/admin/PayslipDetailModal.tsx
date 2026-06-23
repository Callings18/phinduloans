import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@phinduloans/shared/components/ui/dialog";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import { Download } from "lucide-react";
import { formatZMW, getMonthName } from "@phinduloans/shared/utils/payrollCalculations";
import { generatePayslipPDF } from "@/utils/payslipPdfGenerator";

interface PayslipDetailModalProps {
  record: any;
  run: any;
  open: boolean;
  onClose: () => void;
}

export default function PayslipDetailModal({ record, run, open, onClose }: PayslipDetailModalProps) {
  const emp = record.employees;
  const empName = emp?.full_name || "Employee";
  const period = run ? `${getMonthName(run.payroll_month)} ${run.payroll_year}` : "";

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{empName} — Payslip</DialogTitle>
          <DialogDescription>{period} • {emp?.department || "—"} • {emp?.position || "—"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Earnings */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Earnings</h4>
            <Row label="Basic Salary" value={formatZMW(Number(record.basic_salary || 0))} />
            <Row label="Housing Allowance" value={formatZMW(Number(record.housing_allowance || 0))} />
            <Row label="Transport Allowance" value={formatZMW(Number(record.transport_allowance || 0))} />
            <Row label="Lunch Allowance" value={formatZMW(Number(record.lunch_allowance || 0))} />
            <Row label="Other Allowances" value={formatZMW(Number(record.other_allowances || 0))} />
            <Row label="Overtime Pay" value={formatZMW(Number(record.overtime_pay || 0))} />
            <Row label="Commission" value={formatZMW(Number(record.commission_amount || 0))} />
            <Separator className="my-2" />
            <Row label="Gross Pay" value={formatZMW(Number(record.gross_pay || 0))} bold />
          </div>

          {/* Statutory Deductions */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statutory Deductions</h4>
            <Row label="PAYE (Income Tax)" value={formatZMW(Number(record.paye_tax || 0))} />
            <Row label="NHIMA (Employee 1%)" value={formatZMW(Number(record.nhima_employee || 0))} />
            <Row label="NAPSA (Employee 5%)" value={formatZMW(Number(record.napsa_employee || 0))} />
          </div>

          {/* Other Deductions */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Other Deductions</h4>
            <Row label="Loan Deduction" value={formatZMW(Number(record.loan_deduction || 0))} />
            <Row label="Pension" value={formatZMW(Number(record.pension_deduction || 0))} />
            <Row label="Union Dues" value={formatZMW(Number(record.union_dues || 0))} />
            <Row label="Other Deductions" value={formatZMW(Number(record.other_deductions || 0))} />
            <Separator className="my-2" />
            <Row label="Total Deductions" value={formatZMW(Number(record.total_deductions || 0))} bold />
          </div>

          <Separator />

          {/* Net Pay */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <Row label="Net Pay" value={formatZMW(Number(record.net_pay || 0))} bold />
          </div>

          {/* Employer Contributions */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Employer Contributions</h4>
            <Row label="NHIMA (Employer 1%)" value={formatZMW(Number(record.nhima_employer || 0))} />
            <Row label="NAPSA (Employer 5%)" value={formatZMW(Number(record.napsa_employer || 0))} />
            <Separator className="my-2" />
            <Row label="Total Employer Cost" value={formatZMW(Number(record.total_employer_cost || 0))} bold />
          </div>

          {/* Bank Details */}
          {emp?.bank_name && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment Details</h4>
              <Row label="Bank" value={emp.bank_name} />
              {emp.bank_account_number && <Row label="Account" value={emp.bank_account_number} />}
            </div>
          )}

          <Button className="w-full" onClick={() => generatePayslipPDF(record, run)}>
            <Download size={14} className="mr-2" /> Download Payslip PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
