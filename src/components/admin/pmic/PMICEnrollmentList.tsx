import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePMIC, PMICEnrollment } from "@/hooks/usePMIC";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, MoreHorizontal, CheckCircle, XCircle, PauseCircle, Users } from "lucide-react";

const PMICEnrollmentList = () => {
  const { 
    enrollments, 
    employers, 
    stats,
    fetchEnrollments, 
    fetchEmployers,
    createEnrollment, 
    updateEnrollmentStatus 
  } = usePMIC();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [borrowers, setBorrowers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [formData, setFormData] = useState({
    borrower_id: '',
    employer_id: '',
    employee_number: '',
    department: '',
    gross_salary: 0,
    net_salary: 0,
    existing_deductions: 0,
  });

  useEffect(() => {
    fetchEnrollments();
    fetchEmployers();
    fetchBorrowers();
  }, [fetchEnrollments, fetchEmployers]);

  const fetchBorrowers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    setBorrowers(data || []);
  };

  const filteredEnrollments = enrollments.filter(e => {
    const matchesSearch = 
      e.employee_number.toLowerCase().includes(search.toLowerCase()) ||
      e.borrower?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.employer?.employer_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || e.enrollment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async () => {
    await createEnrollment(formData);
    setDialogOpen(false);
    setFormData({
      borrower_id: '',
      employer_id: '',
      employee_number: '',
      department: '',
      gross_salary: 0,
      net_salary: 0,
      existing_deductions: 0,
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 2,
    }).format(amount).replace('ZMW', 'K');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-amber-100 text-amber-800',
      suspended: 'bg-red-100 text-red-800',
      terminated: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.activeEnrollments}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pendingEnrollments}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Total Capacity</div>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalDeductionCapacity)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search enrollments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Enrollment
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Employee #</TableHead>
              <TableHead>Employer</TableHead>
              <TableHead>Gross Salary</TableHead>
              <TableHead>Net Salary</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEnrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No enrollments found
                </TableCell>
              </TableRow>
            ) : (
              filteredEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{enrollment.borrower?.full_name || '-'}</div>
                      <div className="text-sm text-muted-foreground">{enrollment.borrower?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{enrollment.employee_number}</TableCell>
                  <TableCell>{enrollment.employer?.employer_name || '-'}</TableCell>
                  <TableCell>{formatCurrency(enrollment.gross_salary)}</TableCell>
                  <TableCell>{formatCurrency(enrollment.net_salary)}</TableCell>
                  <TableCell className="font-medium text-emerald-600">
                    {formatCurrency(enrollment.available_deduction_capacity)}
                  </TableCell>
                  <TableCell>{getStatusBadge(enrollment.enrollment_status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {enrollment.enrollment_status === 'pending' && (
                          <DropdownMenuItem onClick={() => updateEnrollmentStatus(enrollment.id, 'active')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                            Activate
                          </DropdownMenuItem>
                        )}
                        {enrollment.enrollment_status === 'active' && (
                          <DropdownMenuItem onClick={() => updateEnrollmentStatus(enrollment.id, 'suspended')}>
                            <PauseCircle className="h-4 w-4 mr-2 text-amber-600" />
                            Suspend
                          </DropdownMenuItem>
                        )}
                        {enrollment.enrollment_status === 'suspended' && (
                          <DropdownMenuItem onClick={() => updateEnrollmentStatus(enrollment.id, 'active')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => updateEnrollmentStatus(enrollment.id, 'terminated')}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Terminate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Enrollment</DialogTitle>
            <DialogDescription>
              Enroll a borrower for payroll deductions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Borrower</Label>
              <Select
                value={formData.borrower_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, borrower_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select borrower" />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.full_name || b.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Employer</Label>
              <Select
                value={formData.employer_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, employer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  {employers.filter(e => e.is_verified).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Number</Label>
                <Input
                  value={formData.employee_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
                  placeholder="e.g., EMP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gross Salary (K)</Label>
                <Input
                  type="number"
                  value={formData.gross_salary || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gross_salary: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Net Salary (K)</Label>
                <Input
                  type="number"
                  value={formData.net_salary || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, net_salary: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Existing Deductions (K)</Label>
              <Input
                type="number"
                value={formData.existing_deductions || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, existing_deductions: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Other deductions already in place (PAYE, pension, etc.)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.borrower_id || !formData.employee_number}>
              Add Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PMICEnrollmentList;
