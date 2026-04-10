import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Users,
  Calendar,
  Loader2,
  Download,
  CheckCircle,
  Play,
  Eye,
  Banknote,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchTaxConfig,
  calculatePayroll,
  formatZMW,
  getMonthName,
  type PayrollCalculation,
  type TaxConfig,
} from "@/utils/payrollCalculations";
import PayslipDetailModal from "@/components/admin/PayslipDetailModal";
import { generatePayslipPDF, generateAllPayslipsPDF } from "@/utils/payslipPdfGenerator";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const AdminPayroll = () => {
  const { can } = usePermissions();
  const { user } = useAuth();
  const canAccess = can("payroll", "view") || can("payroll", "manage");
  const canMutate = can("payroll", "manage");
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // ── Queries ──────────────────────────────────────────────

  const { data: payrollRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("payroll_runs") as any)
        .select("*")
        .order("payroll_year", { ascending: false })
        .order("payroll_month", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: runRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["payroll-run-records", expandedRunId],
    queryFn: async () => {
      if (!expandedRunId) return [];
      const { data, error } = await (supabase.from("payroll_records") as any)
        .select("*, employees(id, full_name, email, department, position, bank_name, bank_account_number)")
        .eq("payroll_run_id", expandedRunId)
        .order("basic_salary", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedRunId,
  });

  // ── Generate Payroll Mutation ────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!canMutate) throw new Error("You do not have permission to generate payroll.");

      // 1. Check if run already exists
      const { data: existing, error: existingErr } = await (supabase.from("payroll_runs") as any)
        .select("id")
        .eq("payroll_month", selectedMonth)
        .eq("payroll_year", selectedYear)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) throw new Error(`Payroll for ${getMonthName(selectedMonth)} ${selectedYear} already exists`);

      // 2. Fetch active employees
      const { data: employees, error: empErr } = await (supabase.from("employees") as any)
        .select("id, full_name, salary, housing_allowance, transport_allowance, lunch_allowance, other_allowances, commission_percentage, user_id")
        .eq("is_active", true);
      if (empErr) throw empErr;
      if (!employees?.length) throw new Error("No active employees found");

      // 3. Fetch tax config
      const taxConfig = await fetchTaxConfig();

      // 4. Calculate commission from loans processed (single query + in-memory split)
      const commissionByEmployee: Record<string, number> = {};
      const commissionStaffIds = employees
        .filter((e: any) => e.user_id && e.commission_percentage)
        .map((e: any) => e.user_id as string);
      const periodStart = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const periodEnd =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;

      if (commissionStaffIds.length > 0) {
        const orFilter = commissionStaffIds
          .flatMap((uid: string) => [`approved_by.eq.${uid}`, `disbursed_by.eq.${uid}`])
          .join(",");
        const { data: periodLoans, error: loansErr } = await (supabase.from("loan_applications") as any)
          .select("loan_amount, approved_by, disbursed_by")
          .or(orFilter)
          .gte("approved_at", periodStart)
          .lt("approved_at", periodEnd);
        if (loansErr) throw loansErr;

        for (const emp of employees as any[]) {
          if (!emp.user_id || !emp.commission_percentage) continue;
          const uid = emp.user_id as string;
          const loansForEmp = (periodLoans ?? []).filter(
            (l: any) => l.approved_by === uid || l.disbursed_by === uid,
          );
          if (loansForEmp.length === 0) continue;
          const totalDisbursed = loansForEmp.reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0);
          commissionByEmployee[emp.id] = Math.round(totalDisbursed * (emp.commission_percentage / 100) * 100) / 100;
        }
      }

      // 5. Calculate payroll for each employee
      const calculations: PayrollCalculation[] = employees.map((emp: any) => {
        return calculatePayroll({
          employee: emp,
          commission: commissionByEmployee[emp.id] || 0,
          taxConfig,
        });
      });

      // 6. Create payroll_run
      const totals = calculations.reduce(
        (acc, c) => ({
          gross: acc.gross + c.gross_pay,
          paye: acc.paye + c.paye_tax,
          nhima: acc.nhima + c.nhima_employee + c.nhima_employer,
          napsa: acc.napsa + c.napsa_employee + c.napsa_employer,
          net: acc.net + c.net_pay,
          employerCost: acc.employerCost + c.total_employer_cost,
        }),
        { gross: 0, paye: 0, nhima: 0, napsa: 0, net: 0, employerCost: 0 }
      );

      const { data: run, error: runErr } = await (supabase.from("payroll_runs") as any)
        .insert({
          payroll_month: selectedMonth,
          payroll_year: selectedYear,
          total_employees: employees.length,
          total_gross: Math.round(totals.gross * 100) / 100,
          total_paye: Math.round(totals.paye * 100) / 100,
          total_nhima: Math.round(totals.nhima * 100) / 100,
          total_napsa: Math.round(totals.napsa * 100) / 100,
          total_net: Math.round(totals.net * 100) / 100,
          total_employer_cost: Math.round(totals.employerCost * 100) / 100,
          status: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (runErr) throw runErr;

      // 7. Create payroll_records
      const records = calculations.map((c) => ({
        employee_id: c.employee_id,
        payroll_run_id: run.id,
        payroll_month: selectedMonth,
        payroll_year: selectedYear,
        basic_salary: c.basic_salary,
        housing_allowance: c.housing_allowance,
        transport_allowance: c.transport_allowance,
        lunch_allowance: c.lunch_allowance,
        other_allowances: c.other_allowances,
        overtime_pay: c.overtime_pay,
        commission_amount: c.commission_amount,
        gross_pay: c.gross_pay,
        paye_tax: c.paye_tax,
        nhima_employee: c.nhima_employee,
        nhima_employer: c.nhima_employer,
        napsa_employee: c.napsa_employee,
        napsa_employer: c.napsa_employer,
        loan_deduction: c.loan_deduction,
        pension_deduction: c.pension_deduction,
        union_dues: c.union_dues,
        other_deductions: c.other_deductions,
        total_deductions: c.total_deductions,
        net_pay: c.net_pay,
        total_employer_cost: c.total_employer_cost,
        status: "draft",
        created_by: user.id,
      }));

      const { error: recErr } = await (supabase.from("payroll_records") as any).insert(records);
      if (recErr) throw recErr;

      return { count: employees.length, runId: run.id };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success(`Payroll generated for ${getMonthName(selectedMonth)} ${selectedYear} — ${count} employees`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate payroll"),
  });

  // ── Approve / Pay Mutations ──────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (runId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("payroll_runs") as any)
        .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
        .eq("id", runId)
        .eq("status", "draft");
      if (error) throw error;
      const { error: recApproveErr } = await (supabase.from("payroll_records") as any)
        .update({ status: "approved" })
        .eq("payroll_run_id", runId);
      if (recApproveErr) throw recApproveErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-records"] });
      toast.success("Payroll approved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (runId: string) => {
      const now = new Date().toISOString();
      const { error } = await (supabase.from("payroll_runs") as any)
        .update({ status: "paid" })
        .eq("id", runId)
        .eq("status", "approved");
      if (error) throw error;
      const { error: recPaidErr } = await (supabase.from("payroll_records") as any)
        .update({ status: "paid", paid_at: now })
        .eq("payroll_run_id", runId);
      if (recPaidErr) throw recPaidErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-records"] });
      toast.success("Payroll marked as paid");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Permission Guard ─────────────────────────────────────

  if (!canAccess) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <Card><CardContent className="p-6"><p className="text-muted-foreground">You don't have permission to view this page.</p></CardContent></Card>
        </div>
      </AdminLayout>
    );
  }

  // ── Summary Cards ────────────────────────────────────────

  const latestRun = payrollRuns[0];
  const totalPaidRuns = payrollRuns.filter((r: any) => r.status === "paid").length;
  const totalNetAllTime = payrollRuns.reduce((s: number, r: any) => s + Number(r.total_net || 0), 0);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      approved: "bg-primary/10 text-primary border-primary/30",
      paid: "bg-success/10 text-success border-success/30",
      cancelled: "bg-destructive/10 text-destructive border-destructive/30",
    };
    return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
  };

  const expandedRun = payrollRuns.find((r: any) => r.id === expandedRunId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">Generate, approve, and manage monthly payroll with Zambian statutory deductions</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payrollRuns.length}</div>
              <p className="text-xs text-muted-foreground">{totalPaidRuns} paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Net Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestRun ? formatZMW(Number(latestRun.total_net || 0)) : "—"}</div>
              <p className="text-xs text-muted-foreground">{latestRun ? `${getMonthName(latestRun.payroll_month)} ${latestRun.payroll_year}` : "No runs yet"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest PAYE</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestRun ? formatZMW(Number(latestRun.total_paye || 0)) : "—"}</div>
              <p className="text-xs text-muted-foreground">Tax deducted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestRun?.total_employees ?? 0}</div>
              <p className="text-xs text-muted-foreground">In latest run</p>
            </CardContent>
          </Card>
        </div>

        {/* Generate New Payroll */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play size={18} className="text-primary" /> Generate New Payroll Run
            </CardTitle>
            <CardDescription>
              Select a month and year to generate payroll for all active employees using current Zambian tax rates (PAYE, NHIMA, NAPSA)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canMutate || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Banknote size={16} className="mr-2" />
                )}
                Generate Payroll
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Runs History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={18} className="text-primary" /> Payroll Runs History
            </CardTitle>
            <CardDescription>Click a run to view individual employee records</CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
            ) : payrollRuns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payroll runs yet. Generate your first payroll above.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">PAYE</TableHead>
                    <TableHead className="text-right">NHIMA</TableHead>
                    <TableHead className="text-right">NAPSA</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((run: any) => (
                    <TableRow key={run.id} className={expandedRunId === run.id ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{getMonthName(run.payroll_month)} {run.payroll_year}</TableCell>
                      <TableCell>{run.total_employees}</TableCell>
                      <TableCell className="text-right">{formatZMW(Number(run.total_gross || 0))}</TableCell>
                      <TableCell className="text-right">{formatZMW(Number(run.total_paye || 0))}</TableCell>
                      <TableCell className="text-right">{formatZMW(Number(run.total_nhima || 0))}</TableCell>
                      <TableCell className="text-right">{formatZMW(Number(run.total_napsa || 0))}</TableCell>
                      <TableCell className="text-right font-semibold">{formatZMW(Number(run.total_net || 0))}</TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}>
                            <Eye size={14} className="mr-1" /> {expandedRunId === run.id ? "Hide" : "View"}
                          </Button>
                          {run.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveMutation.mutate(run.id)}
                              disabled={!canMutate || approveMutation.isPending}
                            >
                              {approveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                              Approve
                            </Button>
                          )}
                          {run.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => markPaidMutation.mutate(run.id)}
                              disabled={!canMutate || markPaidMutation.isPending}
                            >
                              {markPaidMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <DollarSign size={14} className="mr-1" />}
                              Mark Paid
                            </Button>
                          )}
                          {(run.status === "approved" || run.status === "paid") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (expandedRunId === run.id && runRecords.length > 0) {
                                  generateAllPayslipsPDF(runRecords, run);
                                } else {
                                  toast.info("View run first to download all payslips");
                                  setExpandedRunId(run.id);
                                }
                              }}
                            >
                              <Download size={14} className="mr-1" /> All Payslips
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Expanded Run Records */}
        {expandedRunId && expandedRun && (
          <Card>
            <CardHeader>
              <CardTitle>{getMonthName(expandedRun.payroll_month)} {expandedRun.payroll_year} — Employee Records</CardTitle>
              <CardDescription>Individual payroll breakdowns. Click an employee to see full details.</CardDescription>
            </CardHeader>
            <CardContent>
              {recordsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
              ) : runRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No records for this run.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">Allowances</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">PAYE</TableHead>
                        <TableHead className="text-right">NHIMA</TableHead>
                        <TableHead className="text-right">NAPSA</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runRecords.map((rec: any) => {
                        const totalAllowances = Number(rec.housing_allowance || 0) + Number(rec.transport_allowance || 0) + Number(rec.lunch_allowance || 0) + Number(rec.other_allowances || 0);
                        return (
                          <TableRow key={rec.id}>
                            <TableCell className="font-medium">{rec.employees?.full_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{rec.employees?.department || "—"}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.basic_salary || 0))}</TableCell>
                            <TableCell className="text-right">{formatZMW(totalAllowances)}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.commission_amount || 0))}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.gross_pay || 0))}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.paye_tax || 0))}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.nhima_employee || 0))}</TableCell>
                            <TableCell className="text-right">{formatZMW(Number(rec.napsa_employee || 0))}</TableCell>
                            <TableCell className="text-right font-semibold">{formatZMW(Number(rec.net_pay || 0))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(rec)}>
                                  <Eye size={14} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => generatePayslipPDF(rec, expandedRun)}>
                                  <Download size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Run Totals Summary */}
                  <Separator className="my-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Total Gross:</span> <span className="font-semibold">{formatZMW(Number(expandedRun.total_gross || 0))}</span></div>
                    <div><span className="text-muted-foreground">Total PAYE:</span> <span className="font-semibold">{formatZMW(Number(expandedRun.total_paye || 0))}</span></div>
                    <div><span className="text-muted-foreground">Total Net:</span> <span className="font-semibold">{formatZMW(Number(expandedRun.total_net || 0))}</span></div>
                    <div><span className="text-muted-foreground">Employer Cost:</span> <span className="font-semibold">{formatZMW(Number(expandedRun.total_employer_cost || 0))}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payslip Detail Modal */}
      {selectedRecord && (
        <PayslipDetailModal
          record={selectedRecord}
          run={expandedRun}
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminPayroll;
