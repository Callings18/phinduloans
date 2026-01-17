import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  CreditCard,
  Plus,
  Search,
  Loader2,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import {
  calculateCompletePayroll,
  calculatePAYE,
  calculateNAPSAEmployee,
  calculateNAPSAEmployer,
  calculateNHIMA,
} from "@/utils/zambianPayrollCalculations";

interface PayrollPeriod {
  id: string;
  period_name: string;
  period_type: string;
  period_start_date: string;
  period_end_date: string;
  pay_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employees: number;
  created_at: string;
}

interface PayrollRecord {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  meal_allowance: number;
  medical_allowance: number;
  communication_allowance: number;
  other_allowances: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  gross_salary: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_contribution: number;
  paye_tax: number;
  union_dues: number;
  loan_deductions: number;
  advance_deductions: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  payment_status: string;
  employees?: {
    employee_number: string;
    first_name: string;
    last_name: string;
    position: string;
    department: string | null;
  };
}

const AdminPayroll = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PayrollRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [periodFormData, setPeriodFormData] = useState({
    period_name: "",
    period_type: "monthly",
    period_start_date: "",
    period_end_date: "",
    pay_date: "",
  });

  // Fetch payroll periods
  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["payroll-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .order("period_start_date", { ascending: false });

      if (error) throw error;
      return data as PayrollPeriod[];
    },
  });

  // Fetch active employees for payroll processing
  const { data: activeEmployees } = useQuery({
    queryKey: ["active-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_number, first_name, last_name, position, department")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll records for selected period
  const { data: payrollRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["payroll-records", selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod?.id) return [];
      const { data, error } = await supabase
        .from("payroll_records")
        .select(`
          *,
          employee:employees!payroll_records_employee_id_fkey (
            employee_number,
            first_name,
            last_name,
            position,
            department
          )
        `)
        .eq("payroll_period_id", selectedPeriod.id)
        .order("employee_id");

      if (error) throw error;
      return data as PayrollRecord[];
    },
    enabled: !!selectedPeriod?.id,
  });

  // Fetch employee salary structures
  const { data: salaryStructures } = useQuery({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salary_structure")
        .select("*")
        .order("effective_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const createPeriodMutation = useMutation({
    mutationFn: async (data: typeof periodFormData) => {
      const { error } = await supabase.from("payroll_periods").insert({
        period_name: data.period_name,
        period_type: data.period_type,
        period_start_date: data.period_start_date,
        period_end_date: data.period_end_date,
        pay_date: data.pay_date,
        status: "draft",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      toast({
        title: "Success",
        description: "Payroll period created successfully",
      });
      setPeriodFormData({
        period_name: "",
        period_type: "monthly",
        period_start_date: "",
        period_end_date: "",
        pay_date: "",
      });
      setIsPeriodDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payroll period",
        variant: "destructive",
      });
    },
  });

  const processPayrollMutation = useMutation({
    mutationFn: async (periodId: string) => {
      if (!activeEmployees || activeEmployees.length === 0) {
        throw new Error("No active employees found");
      }

      const records: any[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const employee of activeEmployees) {
        // Get current salary structure for employee
        const salaryStructure = salaryStructures?.find(
          (s: any) =>
            s.employee_id === employee.id &&
            (!s.expiry_date || new Date(s.expiry_date) >= new Date())
        );

        if (!salaryStructure) {
          console.warn(`No salary structure found for employee ${employee.id}`);
          continue;
        }

        // Calculate gross salary
        const grossSalary =
          Number(salaryStructure.basic_salary) +
          Number(salaryStructure.housing_allowance || 0) +
          Number(salaryStructure.transport_allowance || 0) +
          Number(salaryStructure.meal_allowance || 0) +
          Number(salaryStructure.medical_allowance || 0) +
          Number(salaryStructure.communication_allowance || 0) +
          Number(salaryStructure.other_allowances || 0);

        // Calculate Zambian deductions
        const payrollCalc = calculateCompletePayroll(grossSalary, 300, {
          unionDues: Number(salaryStructure.union_dues || 0),
          loanDeductions: Number(salaryStructure.loan_deductions || 0),
          otherDeductions: Number(salaryStructure.other_deductions || 0),
        });

        const record = {
          payroll_period_id: periodId,
          employee_id: employee.id,
          basic_salary: Number(salaryStructure.basic_salary),
          housing_allowance: Number(salaryStructure.housing_allowance || 0),
          transport_allowance: Number(salaryStructure.transport_allowance || 0),
          meal_allowance: Number(salaryStructure.meal_allowance || 0),
          medical_allowance: Number(salaryStructure.medical_allowance || 0),
          communication_allowance: Number(salaryStructure.communication_allowance || 0),
          other_allowances: Number(salaryStructure.other_allowances || 0),
          overtime_amount: 0,
          bonus_amount: 0,
          commission_amount: 0,
          gross_salary: grossSalary,
          napsa_employee: payrollCalc.deductions.napsaEmployee,
          napsa_employer: calculateNAPSAEmployer(grossSalary),
          nhima_contribution: payrollCalc.deductions.nhima,
          paye_tax: payrollCalc.deductions.paye,
          union_dues: payrollCalc.deductions.unionDues,
          loan_deductions: payrollCalc.deductions.loanDeductions,
          advance_deductions: 0,
          other_deductions: payrollCalc.deductions.otherDeductions,
          created_by: user?.id,
        };

        records.push(record);
        totalGross += grossSalary;
        totalDeductions += payrollCalc.totalDeductions;
        totalNet += payrollCalc.netSalary;
      }

      // Insert all records
      const { error: insertError } = await supabase
        .from("payroll_records")
        .insert(records);

      if (insertError) throw insertError;

      // Update period totals
      const { error: updateError } = await supabase
        .from("payroll_periods")
        .update({
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
          total_employees: records.length,
          status: "processing",
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq("id", periodId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      toast({
        title: "Success",
        description: "Payroll processed successfully",
      });
      setIsProcessDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process payroll",
        variant: "destructive",
      });
    },
  });

  const approvePayrollMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase
        .from("payroll_periods")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", periodId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      toast({
        title: "Success",
        description: "Payroll approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve payroll",
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ periodId, recordIds }: { periodId: string; recordIds: string[] }) => {
      const { error } = await supabase
        .from("payroll_records")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .in("id", recordIds);

      if (error) throw error;

      // Check if all records are paid
      const { data: remaining } = await supabase
        .from("payroll_records")
        .select("id")
        .eq("payroll_period_id", periodId)
        .neq("payment_status", "paid");

      if (remaining && remaining.length === 0) {
        await supabase
          .from("payroll_periods")
          .update({ status: "paid" })
          .eq("id", periodId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      toast({
        title: "Success",
        description: "Payments marked as paid",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment status",
        variant: "destructive",
      });
    },
  });

  const filteredRecords = payrollRecords?.filter((record) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const employee = record.employees;
    return (
      employee?.first_name.toLowerCase().includes(search) ||
      employee?.last_name.toLowerCase().includes(search) ||
      employee?.employee_number.toLowerCase().includes(search) ||
      employee?.position.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-warning/20 text-warning border-warning/30" },
      processing: { label: "Processing", className: "bg-info/20 text-info border-info/30" },
      approved: { label: "Approved", className: "bg-success/20 text-success border-success/30" },
      paid: { label: "Paid", className: "bg-primary/20 text-primary border-primary/30" },
      cancelled: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30" },
    };
    return config[status] || { label: status, className: "bg-muted" };
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll Management</h1>
            <p className="text-muted-foreground mt-1">
              Process and manage employee payroll with Zambian tax compliance
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isPeriodDialogOpen} onOpenChange={setIsPeriodDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus size={18} className="mr-2" />
                  New Period
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Payroll Period</DialogTitle>
                  <DialogDescription>
                    Create a new payroll period for processing
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="period_name">Period Name *</Label>
                    <Input
                      id="period_name"
                      value={periodFormData.period_name}
                      onChange={(e) =>
                        setPeriodFormData({ ...periodFormData, period_name: e.target.value })
                      }
                      placeholder="e.g., January 2026"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period_type">Period Type *</Label>
                    <Select
                      value={periodFormData.period_type}
                      onValueChange={(value) =>
                        setPeriodFormData({ ...periodFormData, period_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="period_start_date">Start Date *</Label>
                      <Input
                        id="period_start_date"
                        type="date"
                        value={periodFormData.period_start_date}
                        onChange={(e) =>
                          setPeriodFormData({
                            ...periodFormData,
                            period_start_date: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="period_end_date">End Date *</Label>
                      <Input
                        id="period_end_date"
                        type="date"
                        value={periodFormData.period_end_date}
                        onChange={(e) =>
                          setPeriodFormData({
                            ...periodFormData,
                            period_end_date: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay_date">Pay Date *</Label>
                    <Input
                      id="pay_date"
                      type="date"
                      value={periodFormData.pay_date}
                      onChange={(e) =>
                        setPeriodFormData({ ...periodFormData, pay_date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsPeriodDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 gradient-primary"
                      onClick={() => createPeriodMutation.mutate(periodFormData)}
                      disabled={createPeriodMutation.isPending}
                    >
                      {createPeriodMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Period
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="periods" className="w-full">
          <TabsList>
            <TabsTrigger value="periods">Payroll Periods</TabsTrigger>
            <TabsTrigger value="records" disabled={!selectedPeriod}>
              Payroll Records
            </TabsTrigger>
          </TabsList>

          {/* Periods Tab */}
          <TabsContent value="periods" className="space-y-4">
            {periodsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : periods?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No payroll periods
                  </h3>
                  <p className="text-muted-foreground">
                    Create your first payroll period to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {periods?.map((period) => {
                  const statusBadge = getStatusBadge(period.status);
                  return (
                    <Card
                      key={period.id}
                      className={`cursor-pointer hover:border-primary/50 transition-colors ${
                        selectedPeriod?.id === period.id ? "border-primary" : ""
                      }`}
                      onClick={() => setSelectedPeriod(period)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{period.period_name}</CardTitle>
                          <Badge variant="outline" className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </div>
                        <CardDescription>
                          {format(new Date(period.period_start_date), "MMM dd")} -{" "}
                          {format(new Date(period.period_end_date), "MMM dd, yyyy")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pay Date:</span>
                            <span className="font-medium">
                              {format(new Date(period.pay_date), "MMM dd, yyyy")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees:</span>
                            <span className="font-medium">{period.total_employees}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Gross:</span>
                            <span className="font-medium">
                              K{Number(period.total_gross).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Net:</span>
                            <span className="font-medium text-success">
                              K{Number(period.total_net).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          {period.status === "draft" && (
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPeriod(period);
                                setIsProcessDialogOpen(true);
                              }}
                            >
                              <Calculator size={14} className="mr-2" />
                              Process
                            </Button>
                          )}
                          {period.status === "processing" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                approvePayrollMutation.mutate(period.id);
                              }}
                            >
                              <CheckCircle size={14} className="mr-2" />
                              Approve
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Records Tab */}
          <TabsContent value="records" className="space-y-4">
            {selectedPeriod && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedPeriod.period_name}</h2>
                    <p className="text-muted-foreground text-sm">
                      {format(new Date(selectedPeriod.period_start_date), "MMM dd")} -{" "}
                      {format(new Date(selectedPeriod.period_end_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                {recordsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredRecords?.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No payroll records
                      </h3>
                      <p className="text-muted-foreground">
                        {selectedPeriod.status === "draft"
                          ? "Process payroll to generate records"
                          : "No records found for this period"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Payroll Records</CardTitle>
                      <CardDescription>
                        {filteredRecords?.length} employee(s) in this period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead className="text-right">Gross</TableHead>
                              <TableHead className="text-right">NAPSA</TableHead>
                              <TableHead className="text-right">PAYE</TableHead>
                              <TableHead className="text-right">Deductions</TableHead>
                              <TableHead className="text-right">Net Salary</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRecords?.map((record) => {
                              const employee = record.employees;
                              return (
                                <TableRow key={record.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {employee?.first_name} {employee?.last_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {employee?.employee_number}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{employee?.position}</TableCell>
                                  <TableCell className="text-right">
                                    K{Number(record.gross_salary).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    K{Number(record.napsa_employee).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    K{Number(record.paye_tax).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    K{Number(record.total_deductions).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-success">
                                    K{Number(record.net_salary).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        record.payment_status === "paid"
                                          ? "bg-success/20 text-success border-success/30"
                                          : record.payment_status === "processed"
                                          ? "bg-info/20 text-info border-info/30"
                                          : "bg-warning/20 text-warning border-warning/30"
                                      }
                                    >
                                      {record.payment_status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setViewingRecord(record)}
                                    >
                                      <Eye size={16} />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Process Payroll Dialog */}
        <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Payroll</DialogTitle>
              <DialogDescription>
                Process payroll for {selectedPeriod?.period_name}. This will calculate salaries
                and deductions for all active employees.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                This will generate payroll records for {activeEmployees?.length || 0} active
                employees with Zambian tax calculations (NAPSA, PAYE, NHIMA).
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsProcessDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gradient-primary"
                  onClick={() => {
                    if (selectedPeriod) {
                      processPayrollMutation.mutate(selectedPeriod.id);
                    }
                  }}
                  disabled={processPayrollMutation.isPending}
                >
                  {processPayrollMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Process Payroll
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Record Details Dialog */}
        <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {viewingRecord && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {viewingRecord.employees?.first_name}{" "}
                    {viewingRecord.employees?.last_name}
                  </DialogTitle>
                  <DialogDescription>
                    Payroll Details - {selectedPeriod?.period_name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Basic Salary</Label>
                      <p className="font-medium">
                        K{Number(viewingRecord.basic_salary).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Gross Salary</Label>
                      <p className="font-medium text-lg">
                        K{Number(viewingRecord.gross_salary).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Deductions</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NAPSA (5%):</span>
                        <span>K{Number(viewingRecord.napsa_employee).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NHIMA:</span>
                        <span>K{Number(viewingRecord.nhima_contribution).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PAYE Tax:</span>
                        <span>K{Number(viewingRecord.paye_tax).toLocaleString()}</span>
                      </div>
                      {viewingRecord.union_dues > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Union Dues:</span>
                          <span>K{Number(viewingRecord.union_dues).toLocaleString()}</span>
                        </div>
                      )}
                      {viewingRecord.loan_deductions > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Loan Deductions:</span>
                          <span>K{Number(viewingRecord.loan_deductions).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Deductions:</span>
                        <span>K{Number(viewingRecord.total_deductions).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-lg">Net Salary</Label>
                      <p className="font-bold text-2xl text-success">
                        K{Number(viewingRecord.net_salary).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPayroll;
