import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, DollarSign, Users, Calendar, Plus, Loader2, Download, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AdminPayroll = () => {
  const { can } = usePermissions();
  const canManage = can("payroll", "manage");
  const canView = can("payroll", "view");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["admin-payroll-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .order("period_start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: periodRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["admin-payroll-records", selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const { data, error } = await supabase
        .from("payroll_records")
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, department, branch)
        `)
        .eq("payroll_period_id", selectedPeriodId)
        .order("employee_id");
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView && !!selectedPeriodId,
  });

  const selectedPeriod = periods.find((p: { id: string }) => p.id === selectedPeriodId);

  if (!canView) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const totalNet = periods.reduce((sum: number, p: { total_net?: number }) => sum + Number(p.total_net ?? 0), 0);
  const nextPay = periods.find((p: { status: string; pay_date: string }) => p.status === "approved" || p.status === "draft");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
            <p className="text-muted-foreground">Manage payroll periods, runs, and payslips</p>
          </div>
          {canManage && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} className="mr-2" />
              New Period
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payroll Periods</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periods.length}</div>
              <p className="text-xs text-muted-foreground">Total periods</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Net (all)</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">K{totalNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Sum of period totals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next pay date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {nextPay ? format(new Date(nextPay.pay_date), "MMM d") : "—"}
              </div>
              <p className="text-xs text-muted-foreground">From next period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periods[0]?.total_employees ?? 0}</div>
              <p className="text-xs text-muted-foreground">Last period</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Periods</CardTitle>
            <CardDescription>Select a period to view records and run payroll</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : periods.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No payroll periods yet. Create one to get started.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Pay date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead className="text-right">Total net</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p: Record<string, unknown>) => (
                    <TableRow
                      key={p.id as string}
                      className={selectedPeriodId === p.id ? "bg-muted/50" : ""}
                    >
                      <TableCell className="font-medium">{p.period_name as string}</TableCell>
                      <TableCell>{format(new Date(p.period_start_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{format(new Date(p.period_end_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{format(new Date(p.pay_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status as string}</Badge>
                      </TableCell>
                      <TableCell>{p.total_employees as number ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {p.total_net != null ? `K${Number(p.total_net).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPeriodId(selectedPeriodId === p.id ? null : (p.id as string))}
                        >
                          {selectedPeriodId === p.id ? "Hide" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selectedPeriodId && selectedPeriod && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedPeriod.period_name} — Records</CardTitle>
              <CardDescription>Payroll records for this period. Run payroll to generate records from employees and salary structures.</CardDescription>
            </CardHeader>
            <CardContent>
              {canManage && selectedPeriod.status === "draft" && (
                <RunPayrollButton
                  periodId={selectedPeriodId}
                  periodName={selectedPeriod.period_name}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["admin-payroll-periods"] });
                    queryClient.invalidateQueries({ queryKey: ["admin-payroll-records", selectedPeriodId] });
                    toast({ title: "Payroll run completed" });
                  }}
                />
              )}
              {recordsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : periodRecords.length === 0 ? (
                <p className="text-muted-foreground py-4">No payroll records yet. Run payroll for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Basic</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Payslip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodRecords.map((rec: Record<string, unknown>) => (
                      <TableRow key={rec.id as string}>
                        <TableCell className="font-medium">
                          {rec.employee
                            ? `${(rec.employee as { first_name?: string }).first_name ?? ""} ${(rec.employee as { last_name?: string }).last_name ?? ""}`
                            : rec.employee_id}
                        </TableCell>
                        <TableCell>K{Number(rec.basic_salary ?? 0).toLocaleString()}</TableCell>
                        <TableCell>K{Number(rec.commission_amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell>K{Number(rec.bonus_amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell>K{Number(rec.gross_salary ?? 0).toLocaleString()}</TableCell>
                        <TableCell>K{Number((rec as { total_deductions?: number }).total_deductions ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">K{Number((rec as { net_salary?: number }).net_salary ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generatePayslipPDF(rec, selectedPeriod)}
                          >
                            <Download size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {canManage && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Payroll Period</DialogTitle>
              <DialogDescription>Add a new payroll period. Status will be draft until you run payroll and approve.</DialogDescription>
            </DialogHeader>
            <CreatePeriodForm
              onSuccess={() => {
                setIsCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ["admin-payroll-periods"] });
                toast({ title: "Period created" });
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
};

function CreatePeriodForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payroll_periods").insert({
        period_name: periodName,
        period_type: "monthly",
        period_start_date: periodStart,
        period_end_date: periodEnd,
        pay_date: payDate,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => onSuccess(),
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Period name</Label>
        <Input value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="e.g. January 2026" />
      </div>
      <div className="space-y-2">
        <Label>Start date</Label>
        <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>End date</Label>
        <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Pay date</Label>
        <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!periodName || !periodStart || !periodEnd || !payDate || createMutation.isPending}
        >
          {createMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
          Create
        </Button>
      </DialogFooter>
    </div>
  );
}

function RunPayrollButton({
  periodId,
  periodName,
  onSuccess,
}: {
  periodId: string;
  periodName: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: employees } = await supabase.from("employees").select("id").eq("is_active", true);
      if (!employees?.length) throw new Error("No active employees");

      const { data: structures } = await supabase
        .from("employee_salary_structure")
        .select("employee_id, basic_salary, effective_date, expiry_date")
        .lte("effective_date", today);

      const effectiveStructures = (structures ?? []).filter(
        (s: { expiry_date: string | null }) => s.expiry_date == null || s.expiry_date >= today
      );
      const byEmployee: Record<string, number> = {};
      employees.forEach((emp: { id: string }) => {
        const forEmp = effectiveStructures.filter((s: { employee_id: string }) => s.employee_id === emp.id);
        const latest = forEmp.sort((a: { effective_date: string }, b: { effective_date: string }) => b.effective_date.localeCompare(a.effective_date))[0];
        byEmployee[emp.id] = latest?.basic_salary ?? 0;
      });

      const records = employees.map((emp: { id: string }) => {
        const basic = byEmployee[emp.id] ?? 0;
        return {
          payroll_period_id: periodId,
          employee_id: emp.id,
          basic_salary: basic,
          gross_salary: basic,
          commission_amount: 0,
          bonus_amount: 0,
        };
      });
      const { error: upsertError } = await supabase.from("payroll_records").upsert(records, { onConflict: "payroll_period_id,employee_id" });
      if (upsertError) throw upsertError;
      const totalNet = records.reduce((sum: number, r: { gross_salary: number }) => sum + r.gross_salary, 0);
      await supabase
        .from("payroll_periods")
        .update({
          status: "processing",
          total_employees: employees.length,
          total_net: totalNet,
          total_gross: totalNet,
          total_deductions: 0,
        })
        .eq("id", periodId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payroll-periods"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payroll-records", periodId] });
      onSuccess();
    },
    onError: (e) => toast({ title: "Payroll run failed", description: (e as Error).message, variant: "destructive" }),
  });

  return (
    <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="mb-4">
      {runMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle size={16} className="mr-2" />}
      Run Payroll
    </Button>
  );
}

function generatePayslipPDF(
  rec: Record<string, unknown>,
  period: { period_name: string; period_start_date: string; period_end_date: string; pay_date: string }
) {
  const doc = new jsPDF();
  const employee = rec.employee as { first_name?: string; last_name?: string; employee_number?: string } | null;
  const name = employee ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() : "Employee";
  const empNo = employee?.employee_number ?? "";

  doc.setFontSize(18);
  doc.text("Payslip", 14, 20);
  doc.setFontSize(10);
  doc.text(`Period: ${period.period_name}`, 14, 28);
  doc.text(`Pay date: ${format(new Date(period.pay_date), "yyyy-MM-dd")}`, 14, 34);
  doc.text(`Employee: ${name} (${empNo})`, 14, 40);

  const rows = [
    ["Basic salary", `K${Number(rec.basic_salary ?? 0).toLocaleString()}`],
    ["Commission", `K${Number(rec.commission_amount ?? 0).toLocaleString()}`],
    ["Bonus", `K${Number(rec.bonus_amount ?? 0).toLocaleString()}`],
    ["Gross", `K${Number(rec.gross_salary ?? 0).toLocaleString()}`],
    ["Deductions", `K${Number((rec as { total_deductions?: number }).total_deductions ?? 0).toLocaleString()}`],
    ["Net pay", `K${Number((rec as { net_salary?: number }).net_salary ?? 0).toLocaleString()}`],
  ];

  autoTable(doc, {
    head: [["Item", "Amount"]],
    body: rows,
    startY: 48,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
  });

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Phindu Finance - Confidential", 14, doc.internal.pageSize.height - 10);
  doc.save(`payslip-${empNo || rec.employee_id}-${period.period_name.replace(/\s/g, "-")}.pdf`);
}

export default AdminPayroll;
