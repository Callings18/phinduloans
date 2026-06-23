import { useEffect, useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { usePMIC, PMICException } from "@/hooks/usePMIC";
import { Search, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const PMICExceptionList = () => {
  const { 
    exceptions, 
    stats,
    fetchExceptions, 
    resolveException 
  } = usePMIC();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const filteredExceptions = exceptions.filter(e => {
    const matchesSearch = 
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.enrollment?.employee_number?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || e.exception_status === statusFilter;
    const matchesType = typeFilter === 'all' || e.exception_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleResolve = async () => {
    if (selectedExceptionId && resolution) {
      await resolveException(selectedExceptionId, resolution);
      setResolveDialogOpen(false);
      setSelectedExceptionId(null);
      setResolution("");
    }
  };

  const openResolveDialog = (exceptionId: string) => {
    setSelectedExceptionId(exceptionId);
    setResolveDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-red-100 text-red-800',
      investigating: 'bg-amber-100 text-amber-800',
      resolved: 'bg-emerald-100 text-emerald-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      insufficient_salary: 'bg-red-100 text-red-800',
      employment_terminated: 'bg-amber-100 text-amber-800',
      duplicate_deduction: 'bg-purple-100 text-purple-800',
      invalid_employee: 'bg-blue-100 text-blue-800',
      exceeded_limit: 'bg-orange-100 text-orange-800',
      payroll_error: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      insufficient_salary: 'Insufficient Salary',
      employment_terminated: 'Employment Terminated',
      duplicate_deduction: 'Duplicate Deduction',
      invalid_employee: 'Invalid Employee',
      exceeded_limit: 'Exceeded Limit',
      payroll_error: 'Payroll Error',
    };
    return <Badge className={styles[type] || 'bg-gray-100'}>{labels[type] || type}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Open</div>
          <div className="text-2xl font-bold text-red-600">{stats.openExceptions}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Investigating</div>
          <div className="text-2xl font-bold text-amber-600">{stats.investigatingExceptions}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Resolved</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.resolvedExceptions}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exceptions..."
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
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="insufficient_salary">Insufficient Salary</SelectItem>
            <SelectItem value="employment_terminated">Employment Terminated</SelectItem>
            <SelectItem value="duplicate_deduction">Duplicate Deduction</SelectItem>
            <SelectItem value="invalid_employee">Invalid Employee</SelectItem>
            <SelectItem value="exceeded_limit">Exceeded Limit</SelectItem>
            <SelectItem value="payroll_error">Payroll Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExceptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No exceptions found
                </TableCell>
              </TableRow>
            ) : (
              filteredExceptions.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell>{getTypeBadge(exception.exception_type)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{exception.enrollment?.borrower?.full_name || '-'}</div>
                      <div className="text-sm text-muted-foreground">
                        {exception.enrollment?.employee_number}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{exception.description || '-'}</TableCell>
                  <TableCell>{format(new Date(exception.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{getStatusBadge(exception.exception_status)}</TableCell>
                  <TableCell>
                    {(exception.exception_status === 'open' || exception.exception_status === 'investigating') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openResolveDialog(exception.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                    {exception.exception_status === 'resolved' && (
                      <span className="text-sm text-muted-foreground">
                        {exception.resolution?.substring(0, 30)}...
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Provide a resolution for this exception
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how this exception was resolved..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={!resolution.trim()}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PMICExceptionList;
