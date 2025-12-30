import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { usePMIC, PMICSubmission } from "@/hooks/usePMIC";
import { Plus, Search, MoreHorizontal, Send, CheckCircle, XCircle, FileText, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PMICSubmissionList = () => {
  const { 
    submissions, 
    stats,
    fetchSubmissions, 
    createSubmission, 
    processSubmission 
  } = usePMIC();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    submission_type: 'deduction_request' as PMICSubmission['submission_type'],
    payroll_period_start: null as Date | null,
    payroll_period_end: null as Date | null,
    total_amount: 0,
    total_records: 0,
    notes: '',
  });

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = s.submission_reference.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async () => {
    if (!formData.payroll_period_start || !formData.payroll_period_end) return;
    
    await createSubmission({
      ...formData,
      payroll_period_start: formData.payroll_period_start.toISOString().split('T')[0],
      payroll_period_end: formData.payroll_period_end.toISOString().split('T')[0],
    });
    setDialogOpen(false);
    setFormData({
      submission_type: 'deduction_request',
      payroll_period_start: null,
      payroll_period_end: null,
      total_amount: 0,
      total_records: 0,
      notes: '',
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
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-amber-100 text-amber-800',
      submitted: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      completed: 'bg-emerald-100 text-emerald-800',
      failed: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      deduction_request: 'Deduction',
      stop_order: 'Stop Order',
      variation: 'Variation',
      reconciliation: 'Reconciliation',
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pendingSubmissions}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.completedSubmissions}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Total Amount</div>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalSubmissionAmount)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference..."
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Submission
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No submissions found
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-mono font-medium">{submission.submission_reference}</TableCell>
                  <TableCell>{getTypeBadge(submission.submission_type)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(submission.payroll_period_start), 'dd MMM')} - {format(new Date(submission.payroll_period_end), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>{submission.total_records || '-'}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(submission.total_amount)}</TableCell>
                  <TableCell>{getStatusBadge(submission.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {submission.status === 'draft' && (
                          <DropdownMenuItem onClick={() => processSubmission(submission.id, 'pending')}>
                            <Send className="h-4 w-4 mr-2" />
                            Submit
                          </DropdownMenuItem>
                        )}
                        {submission.status === 'pending' && (
                          <DropdownMenuItem onClick={() => processSubmission(submission.id, 'submitted')}>
                            <Send className="h-4 w-4 mr-2" />
                            Mark as Submitted
                          </DropdownMenuItem>
                        )}
                        {(submission.status === 'submitted' || submission.status === 'processing') && (
                          <>
                            <DropdownMenuItem onClick={() => processSubmission(submission.id, 'completed')}>
                              <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                              Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => processSubmission(submission.id, 'failed')}>
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              Mark Failed
                            </DropdownMenuItem>
                          </>
                        )}
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
            <DialogTitle>New Submission</DialogTitle>
            <DialogDescription>
              Create a new payroll submission
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Submission Type</Label>
              <Select
                value={formData.submission_type}
                onValueChange={(value: PMICSubmission['submission_type']) => 
                  setFormData(prev => ({ ...prev, submission_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deduction_request">Deduction Request</SelectItem>
                  <SelectItem value="stop_order">Stop Order</SelectItem>
                  <SelectItem value="variation">Variation</SelectItem>
                  <SelectItem value="reconciliation">Reconciliation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.payroll_period_start && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.payroll_period_start 
                        ? format(formData.payroll_period_start, "PPP") 
                        : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.payroll_period_start || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, payroll_period_start: date || null }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.payroll_period_end && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.payroll_period_end 
                        ? format(formData.payroll_period_end, "PPP") 
                        : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.payroll_period_end || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, payroll_period_end: date || null }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Records</Label>
                <Input
                  type="number"
                  value={formData.total_records || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_records: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Amount (K)</Label>
                <Input
                  type="number"
                  value={formData.total_amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_amount: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.payroll_period_start || !formData.payroll_period_end}
            >
              Create Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PMICSubmissionList;
