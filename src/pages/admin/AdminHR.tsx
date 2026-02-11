import { useState } from "react";
import { ZAMBIAN_CITIES_LIST } from "@/constants/zambianLocations";

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
import { Users, Building2, FileText, Calendar, Plus, Pencil, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const AdminHR = () => {
  const { can } = usePermissions();
  const canManage = can("payroll", "manage");
  const canView = can("payroll", "view");
  const [editId, setEditId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["admin-hr-employees"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("employees")
        .select("id, user_id, employee_number, first_name, last_name, department, position, branch, commission_percentage, is_active, employment_start_date, email, phone")
        .order("last_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: canView,
  });

  const { data: salaryStructures = [] } = useQuery({
    queryKey: ["admin-hr-salary-structures"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("employee_salary_structure")
        .select("employee_id, basic_salary, effective_date, expiry_date")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: canView && employees.length > 0,
  });

  const getCurrentBasicSalary = (employeeId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const s = salaryStructures.find(
      (x: { employee_id: string; effective_date: string; expiry_date: string | null }) =>
        x.employee_id === employeeId &&
        x.effective_date <= today &&
        (x.expiry_date == null || x.expiry_date >= today)
    );
    if (!s) return null;
    const latest = salaryStructures.filter((x: { employee_id: string }) => x.employee_id === employeeId);
    const current = latest.find(
      (x: { effective_date: string; expiry_date: string | null }) =>
        x.effective_date <= today && (x.expiry_date == null || x.expiry_date >= today)
    );
    return current?.basic_salary ?? null;
  };

  const { data: payrollPeriods = [] } = useQuery({
    queryKey: ["admin-hr-payroll-periods"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("payroll_periods")
        .select("id, period_name, period_start_date, period_end_date, pay_date, status, total_net, total_employees")
        .order("period_start_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: canView,
  });

  const { data: leaveCount } = useQuery({
    queryKey: ["admin-hr-leave-pending"],
    queryFn: async () => {
      const { count, error } = await (supabase.from as any)("employee_leave")
        .select("id", { count: "exact", head: true })
        .gte("end_date", new Date().toISOString().slice(0, 10));
      if (error) throw error;
      return count ?? 0;
    },
    enabled: canView,
  });

  const activeCount = employees.filter((e: { is_active: boolean }) => e.is_active).length;
  const deptSet = new Set(employees.map((e: { department: string | null }) => e.department).filter(Boolean));

  if (!canView) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">HR Management</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">HR Management</h1>
            <p className="text-muted-foreground">Manage employees, department, branch, and commission</p>
          </div>
          {canManage && (
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus size={16} className="mr-2" />
              Add Employee
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">{activeCount} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deptSet.size}</div>
              <p className="text-xs text-muted-foreground">Unique departments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payroll Periods</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payrollPeriods.length}</div>
              <p className="text-xs text-muted-foreground">Recent periods</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leave (ongoing)</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leaveCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">Records</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Employee list with department, branch, and commission</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : employees.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No employees yet. Add one to get started.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee #</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Basic salary</TableHead>
                    <TableHead>Commission %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp: Record<string, unknown>) => (
                    <TableRow key={emp.id as string}>
                      <TableCell className="font-medium">
                        {(emp.first_name as string)} {(emp.last_name as string)}
                      </TableCell>
                      <TableCell>{emp.employee_number as string}</TableCell>
                      <TableCell>{emp.department as string ?? "—"}</TableCell>
                      <TableCell>{emp.branch as string ?? "—"}</TableCell>
                      <TableCell>
                        {getCurrentBasicSalary(emp.id as string) != null
                          ? `K${Number(getCurrentBasicSalary(emp.id as string)).toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell>{emp.commission_percentage != null ? `${emp.commission_percentage}%` : "0%"}</TableCell>
                      <TableCell>
                        <Badge variant={(emp.is_active as boolean) ? "default" : "secondary"}>
                          {(emp.is_active as boolean) ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditId(emp.id as string)}
                          >
                            <Pencil size={14} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payroll Periods</CardTitle>
            <CardDescription>Latest payroll runs</CardDescription>
          </CardHeader>
          <CardContent>
            {payrollPeriods.length === 0 ? (
              <p className="text-muted-foreground py-4">No payroll periods yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Pay date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollPeriods.map((p: Record<string, unknown>) => (
                    <TableRow key={p.id as string}>
                      <TableCell className="font-medium">{p.period_name as string}</TableCell>
                      <TableCell>{format(new Date(p.period_start_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{format(new Date(p.period_end_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{format(new Date(p.pay_date as string), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.status as string}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.total_net != null ? `K${Number(p.total_net).toLocaleString()}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
                <DialogDescription>Create a new employee record. Link to an auth user (staff) optionally.</DialogDescription>
              </DialogHeader>
              <AddEditEmployeeForm
                onSuccess={() => {
                  setIsAddOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["admin-hr-employees"] });
                  toast({ title: "Employee added" });
                }}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
          {editId && (
            <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Employee</DialogTitle>
                  <DialogDescription>Update department, branch, commission, and status.</DialogDescription>
                </DialogHeader>
                <AddEditEmployeeForm
                  editId={editId}
                  onSuccess={() => {
                    setEditId(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-hr-employees"] });
                    toast({ title: "Employee updated" });
                  }}
                  onCancel={() => setEditId(null)}
                />
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </AdminLayout>
  );
};

function AddEditEmployeeForm({
  editId,
  onSuccess,
  onCancel,
}: {
  editId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    employee_number: "",
    nrc_number: "",
    date_of_birth: "",
    department: "",
    position: "",
    employment_type: "permanent",
    employment_start_date: new Date().toISOString().slice(0, 10),
    address: "",
    city: "",
    branch: "",
    commission_percentage: "0",
    user_id: "",
  });
  const queryClient = useQueryClient();

  const editQuery = useQuery({
    queryKey: ["employee-edit", editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await (supabase.from as any)("employees").select("*").eq("id", editId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!editId,
  });

  // Sync form when edit data loads
  const editData = editQuery.data;
  if (editData && form.first_name === "" && form.last_name === "") {
    setForm({
      first_name: editData.first_name ?? "",
      last_name: editData.last_name ?? "",
      email: editData.email ?? "",
      phone: editData.phone ?? "",
      employee_number: editData.employee_number ?? "",
      nrc_number: editData.nrc_number ?? "",
      date_of_birth: editData.date_of_birth ?? "",
      department: editData.department ?? "",
      position: editData.position ?? "",
      employment_type: editData.employment_type ?? "permanent",
      employment_start_date: editData.employment_start_date ?? "",
      address: editData.address ?? "",
      city: editData.city ?? "",
      branch: editData.branch ?? "",
      commission_percentage: editData.commission_percentage != null ? String(editData.commission_percentage) : "0",
      user_id: editData.user_id ?? "",
    });
  }

  const { data: profiles } = useQuery({
    queryKey: ["profiles-staff"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").neq("role", "user").neq("role", "employer");
      if (!roles?.length) return [];
      const ids = roles.map((r: { user_id: string }) => r.user_id);
      const { data: p } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return p ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        employee_number: form.employee_number,
        nrc_number: form.nrc_number,
        date_of_birth: form.date_of_birth || null,
        department: form.department || null,
        position: form.position,
        employment_type: form.employment_type,
        employment_start_date: form.employment_start_date,
        address: form.address || null,
        city: form.city || null,
        branch: form.branch || null,
        commission_percentage: form.commission_percentage ? parseFloat(form.commission_percentage) : 0,
        user_id: form.user_id || null,
      };
      if (editId) {
        const { error } = await (supabase.from as any)("employees").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hr-employees"] });
      onSuccess();
    },
    onError: (e) => {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    },
  });

  const DEPARTMENTS = ["Finance", "Operations", "Lending", "Collections", "IT", "Human Resources", "Administration", "Marketing", "Legal", "Compliance"];
  const BRANCHES = ["Lusaka Main", "Kitwe", "Ndola", "Livingstone", "Kabwe", "Chipata", "Solwezi", "Kasama", "Mongu", "Mansa"];

  const handleNrcChange = (val: string) => {
    // Auto-format NRC: digits/digits/digits e.g. 626914/10/1
    const raw = val.replace(/[^0-9/]/g, "");
    setForm({ ...form, nrc_number: raw });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>First name</Label>
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Last name</Label>
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Employee number</Label>
          <Input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} placeholder="e.g. PHINDU-001" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>NRC number</Label>
          <Input value={form.nrc_number} onChange={e => handleNrcChange(e.target.value)} placeholder="e.g. 626914/10/1" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Date of birth</Label>
          <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={form.department || "none"} onValueChange={(v) => setForm({ ...form, department: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Position</Label>
          <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Employment type</Label>
          <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="permanent">Permanent</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Employment start date</Label>
          <Input type="date" value={form.employment_start_date} onChange={(e) => setForm({ ...form, employment_start_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Commission %</Label>
          <Input type="number" min={0} step={0.5} value={form.commission_percentage} onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Town / City</Label>
          <Select value={form.city || "none"} onValueChange={(v) => setForm({ ...form, city: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {ZAMBIAN_CITIES_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Branch</Label>
          <Select value={form.branch || "none"} onValueChange={(v) => setForm({ ...form, branch: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Link to auth user (staff)</Label>
        <Select value={form.user_id || "none"} onValueChange={(v) => setForm({ ...form, user_id: v === "none" ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Unlinked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unlinked</SelectItem>
            {profiles?.map((p: { id: string; full_name: string | null; email: string }) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
          {editId ? "Update" : "Add"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default AdminHR;
