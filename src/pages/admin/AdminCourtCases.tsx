import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Gavel,
  Search,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  DollarSign,
  Loader2,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

interface CourtCase {
  id: string;
  loan_id: string;
  case_number: string;
  borrower_id: string;
  court_name: string;
  case_type: string;
  filing_date: string;
  hearing_date: string | null;
  case_status: string;
  judgment_amount: number | null;
  judgment_date: string | null;
  enforcement_status: string | null;
  court_costs: number;
  legal_fees: number;
  case_notes: string | null;
  created_at: string;
  full_name?: string;
  email?: string;
  loan_amount?: number;
}

interface CourtCaseEvent {
  id: string;
  court_case_id: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  description: string;
  outcome: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

interface CaseFormData {
  loan_id: string;
  case_number: string;
  court_name: string;
  case_type: string;
  filing_date: string;
  hearing_date: string;
  court_costs: string;
  legal_fees: string;
  case_notes: string;
}

const emptyCaseForm: CaseFormData = {
  loan_id: "",
  case_number: "",
  court_name: "",
  case_type: "recovery",
  filing_date: "",
  hearing_date: "",
  court_costs: "0",
  legal_fees: "0",
  case_notes: "",
};

const AdminCourtCases = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CourtCase | null>(null);
  const [formData, setFormData] = useState<CaseFormData>(emptyCaseForm);
  const [eventFormData, setEventFormData] = useState({
    event_type: "hearing",
    event_date: "",
    event_time: "",
    description: "",
    outcome: "",
    next_action: "",
    next_action_date: "",
  });

  const queryClient = useQueryClient();

  // Fetch court cases
  const { data: courtCases, isLoading } = useQuery({
    queryKey: ["court-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_cases")
        .select(`
          *,
          profiles!court_cases_borrower_id_fkey (
            full_name,
            email
          ),
          loan_applications!court_cases_loan_id_fkey (
            loan_amount
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return data.map(c => ({
        ...c,
        full_name: c.profiles?.full_name,
        email: c.profiles?.email,
        loan_amount: c.loan_applications?.loan_amount,
      }));
    },
  });

  // Fetch defaulted loans for dropdown
  const { data: defaultedLoans } = useQuery({
    queryKey: ["defaulted-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          id,
          user_id,
          loan_amount,
          profiles!loan_applications_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("status", "defaulted");

      if (error) throw error;
      return data;
    },
  });

  // Fetch events for selected case
  const { data: caseEvents } = useQuery({
    queryKey: ["court-case-events", selectedCase?.id],
    queryFn: async () => {
      if (!selectedCase) return [];
      
      const { data, error } = await supabase
        .from("court_case_events")
        .select("*")
        .eq("court_case_id", selectedCase.id)
        .order("event_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCase,
  });

  // Create court case mutation
  const createMutation = useMutation({
    mutationFn: async (data: CaseFormData) => {
      const selectedLoan = defaultedLoans?.find(l => l.id === data.loan_id);
      if (!selectedLoan) throw new Error("Loan not found");

      const { error } = await supabase.from("court_cases").insert({
        loan_id: data.loan_id,
        borrower_id: selectedLoan.user_id,
        case_number: data.case_number,
        court_name: data.court_name,
        case_type: data.case_type,
        filing_date: data.filing_date,
        hearing_date: data.hearing_date || null,
        case_status: "filed",
        court_costs: parseFloat(data.court_costs) || 0,
        legal_fees: parseFloat(data.legal_fees) || 0,
        case_notes: data.case_notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-cases"] });
      toast.success("Court case created successfully");
      setIsAddOpen(false);
      setFormData(emptyCaseForm);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create court case");
    },
  });

  // Update court case mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("court_cases")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-cases"] });
      toast.success("Court case updated successfully");
      setIsEditOpen(false);
      setSelectedCase(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update court case");
    },
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCase) throw new Error("No case selected");

      const { error } = await supabase.from("court_case_events").insert({
        court_case_id: selectedCase.id,
        event_type: eventFormData.event_type,
        event_date: eventFormData.event_date,
        event_time: eventFormData.event_time || null,
        description: eventFormData.description,
        outcome: eventFormData.outcome || null,
        next_action: eventFormData.next_action || null,
        next_action_date: eventFormData.next_action_date || null,
        recorded_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-case-events"] });
      toast.success("Event added successfully");
      setIsAddEventOpen(false);
      setEventFormData({
        event_type: "hearing",
        event_date: "",
        event_time: "",
        description: "",
        outcome: "",
        next_action: "",
        next_action_date: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add event");
    },
  });

  const filteredCases = courtCases?.filter((c) => {
    const matchesSearch =
      c.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.court_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.case_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      filed: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: FileText },
      pending_hearing: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      judgment_obtained: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      enforcement: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
      closed: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: XCircle },
      withdrawn: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    };
    const config = configs[status] || configs.filed;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.color}>
        <Icon size={12} className="mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const stats = {
    total: courtCases?.length || 0,
    active: courtCases?.filter(c => !['closed', 'withdrawn'].includes(c.case_status)).length || 0,
    judgmentObtained: courtCases?.filter(c => c.case_status === 'judgment_obtained').length || 0,
    totalRecovery: courtCases?.reduce((sum, c) => sum + (Number(c.judgment_amount) || 0), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Gavel className="text-primary" size={32} />
            Court Cases
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage legal proceedings and court cases for defaulted loans
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cases</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <Gavel className="text-primary" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Cases</p>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                </div>
                <FileText className="text-info" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Judgments</p>
                  <p className="text-2xl font-bold text-foreground">{stats.judgmentObtained}</p>
                </div>
                <CheckCircle className="text-success" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recovery</p>
                  <p className="text-2xl font-bold text-foreground">K{stats.totalRecovery.toLocaleString()}</p>
                </div>
                <DollarSign className="text-success" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by case number, borrower, or court..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="filed">Filed</SelectItem>
                <SelectItem value="pending_hearing">Pending Hearing</SelectItem>
                <SelectItem value="judgment_obtained">Judgment Obtained</SelectItem>
                <SelectItem value="enforcement">Enforcement</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus size={18} className="mr-2" />
              New Case
            </Button>
          </div>
        </div>

        {/* Court Cases Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCases && filteredCases.length > 0 ? (
          <Card className="glass border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case Number</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Filing Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((courtCase) => (
                  <TableRow key={courtCase.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{courtCase.case_number}</p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{courtCase.full_name}</p>
                        <p className="text-sm text-muted-foreground">{courtCase.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted-foreground" />
                        <span className="text-sm">{courtCase.court_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {courtCase.case_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{format(new Date(courtCase.filing_date), "MMM dd, yyyy")}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(courtCase.case_status)}</TableCell>
                    <TableCell>
                      <p className="font-semibold">K{Number(courtCase.loan_amount).toLocaleString()}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCase(courtCase);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye size={16} className="mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCase(courtCase);
                            setFormData({
                              loan_id: courtCase.loan_id,
                              case_number: courtCase.case_number,
                              court_name: courtCase.court_name,
                              case_type: courtCase.case_type,
                              filing_date: courtCase.filing_date,
                              hearing_date: courtCase.hearing_date || "",
                              court_costs: courtCase.court_costs.toString(),
                              legal_fees: courtCase.legal_fees.toString(),
                              case_notes: courtCase.case_notes || "",
                            });
                            setIsEditOpen(true);
                          }}
                        >
                          <Edit size={16} className="mr-1" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <Gavel className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No court cases found</p>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">Try adjusting your search</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Case Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>File New Court Case</DialogTitle>
            <DialogDescription>
              Create a new court case for a defaulted loan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Defaulted Loan *</Label>
              <Select value={formData.loan_id} onValueChange={(value) => setFormData({ ...formData, loan_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a defaulted loan" />
                </SelectTrigger>
                <SelectContent>
                  {defaultedLoans?.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.profiles?.full_name} - K{Number(loan.loan_amount).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Case Number *</Label>
                <Input
                  placeholder="e.g., CC/2026/001"
                  value={formData.case_number}
                  onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Case Type *</Label>
                <Select value={formData.case_type} onValueChange={(value) => setFormData({ ...formData, case_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recovery">Recovery</SelectItem>
                    <SelectItem value="enforcement">Enforcement</SelectItem>
                    <SelectItem value="garnishment">Garnishment</SelectItem>
                    <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Court Name *</Label>
              <Input
                placeholder="e.g., Lusaka Magistrate Court"
                value={formData.court_name}
                onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Filing Date *</Label>
                <Input
                  type="date"
                  value={formData.filing_date}
                  onChange={(e) => setFormData({ ...formData, filing_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Hearing Date</Label>
                <Input
                  type="date"
                  value={formData.hearing_date}
                  onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Court Costs (ZMW)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.court_costs}
                  onChange={(e) => setFormData({ ...formData, court_costs: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>Legal Fees (ZMW)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.legal_fees}
                  onChange={(e) => setFormData({ ...formData, legal_fees: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Case Notes</Label>
              <Textarea
                placeholder="Enter any relevant notes about this case..."
                value={formData.case_notes}
                onChange={(e) => setFormData({ ...formData, case_notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.loan_id || !formData.case_number || !formData.court_name || !formData.filing_date || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Case
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Case Dialog - simplified version, full implementation would include events timeline */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Case Details</DialogTitle>
            <DialogDescription>
              {selectedCase && `Case ${selectedCase.case_number}`}
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Borrower</p>
                  <p className="font-medium">{selectedCase.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedCase.case_status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Court</p>
                  <p className="font-medium">{selectedCase.court_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Case Type</p>
                  <p className="font-medium capitalize">{selectedCase.case_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Filing Date</p>
                  <p className="font-medium">{format(new Date(selectedCase.filing_date), "MMM dd, yyyy")}</p>
                </div>
                {selectedCase.hearing_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hearing Date</p>
                    <p className="font-medium">{format(new Date(selectedCase.hearing_date), "MMM dd, yyyy")}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className="font-medium">K{Number(selectedCase.loan_amount).toLocaleString()}</p>
                </div>
                {selectedCase.judgment_amount && (
                  <div>
                    <p className="text-sm text-muted-foreground">Judgment Amount</p>
                    <p className="font-medium">K{Number(selectedCase.judgment_amount).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedCase.case_notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Case Notes</p>
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-sm">{selectedCase.case_notes}</p>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Case Events</h4>
                  <Button size="sm" onClick={() => setIsAddEventOpen(true)}>
                    <Plus size={16} className="mr-1" />
                    Add Event
                  </Button>
                </div>

                {caseEvents && caseEvents.length > 0 ? (
                  <div className="space-y-2">
                    {caseEvents.map((event: CourtCaseEvent) => (
                      <div key={event.id} className="p-4 rounded-lg border border-border/50 bg-secondary/20">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium capitalize">{event.event_type.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.event_date), "MMM dd, yyyy")}
                              {event.event_time && ` at ${event.event_time}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm mb-2">{event.description}</p>
                        {event.outcome && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Outcome:</span> {event.outcome}
                          </div>
                        )}
                        {event.next_action && (
                          <div className="text-xs text-info mt-1">
                            <span className="font-medium">Next Action:</span> {event.next_action}
                            {event.next_action_date && ` (${format(new Date(event.next_action_date), "MMM dd, yyyy")})`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No events recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Case Event</DialogTitle>
            <DialogDescription>
              Record a new event for this court case
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select value={eventFormData.event_type} onValueChange={(value) => setEventFormData({ ...eventFormData, event_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filing">Filing</SelectItem>
                  <SelectItem value="hearing">Hearing</SelectItem>
                  <SelectItem value="judgment">Judgment</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="document_submission">Document Submission</SelectItem>
                  <SelectItem value="correspondence">Correspondence</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Input
                  type="date"
                  value={eventFormData.event_date}
                  onChange={(e) => setEventFormData({ ...eventFormData, event_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Event Time</Label>
                <Input
                  type="time"
                  value={eventFormData.event_time}
                  onChange={(e) => setEventFormData({ ...eventFormData, event_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe what happened..."
                value={eventFormData.description}
                onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Outcome</Label>
              <Textarea
                placeholder="What was the result or outcome?"
                value={eventFormData.outcome}
                onChange={(e) => setEventFormData({ ...eventFormData, outcome: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Next Action</Label>
              <Textarea
                placeholder="What needs to happen next?"
                value={eventFormData.next_action}
                onChange={(e) => setEventFormData({ ...eventFormData, next_action: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Next Action Date</Label>
              <Input
                type="date"
                value={eventFormData.next_action_date}
                onChange={(e) => setEventFormData({ ...eventFormData, next_action_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsAddEventOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addEventMutation.mutate()}
              disabled={!eventFormData.event_date || !eventFormData.description || addEventMutation.isPending}
            >
              {addEventMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCourtCases;
