import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
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
  AlertTriangle,
  FileText,
  DollarSign,
  Loader2,
  Plus,
  Calendar,
  User,
  Phone,
  Scale,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { notificationService } from "@/utils/notificationService";

interface CourtCase {
  id: string;
  loan_id: string;
  case_number: string | null;
  case_type: string;
  court_name: string | null;
  court_location: string | null;
  assigned_lawyer: string | null;
  lawyer_contact: string | null;
  status: string;
  filing_date: string | null;
  hearing_date: string | null;
  next_hearing_date: string | null;
  judgment_date: string | null;
  judgment_amount: number | null;
  claim_amount: number | null;
  recovered_amount: number | null;
  legal_fees: number | null;
  plaintiff_name: string | null;
  defendant_name: string | null;
  enforcement_status: string | null;
  notes: string | null;
  created_at: string;
  loan_applications?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    loan_amount: number;
    total_repayment: number;
  };
}

const caseStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  filed: { label: "Filed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: FileText },
  hearing_scheduled: { label: "Hearing Scheduled", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Calendar },
  in_progress: { label: "In Progress", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Scale },
  judgment_pending: { label: "Judgment Pending", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Clock },
  judgment_received: { label: "Judgment Received", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  enforcement: { label: "Enforcement", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  settled: { label: "Settled", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  dismissed: { label: "Dismissed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
  closed: { label: "Closed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: CheckCircle },
};

const AdminCourtCases = () => {
  const { can } = usePermissions();
  const canManageCourt = can("court", "manage");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CourtCase | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");

  const queryClient = useQueryClient();
  const { data: settings } = useSystemSettings();
  const currency = settings?.generalConfig?.currency || "K";

  const [formData, setFormData] = useState({
    case_number: "",
    case_type: "debt_recovery",
    court_name: "",
    court_location: "",
    assigned_lawyer: "",
    lawyer_contact: "",
    lawyer_email: "",
    status: "filed",
    filing_date: "",
    hearing_date: "",
    claim_amount: "",
    legal_fees: "",
    plaintiff_name: settings?.companyInfo?.name || "Phindu Loans",
    notes: "",
  });

  // Fetch court cases
  const { data: courtCases, isLoading } = useQuery({
    queryKey: ["court-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_cases")
        .select(`
          *,
          loan_applications (
            id,
            full_name,
            email,
            phone,
            loan_amount,
            total_repayment
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CourtCase[];
    },
  });

  // Fetch defaulted loans for creating new cases
  const { data: defaultedLoans } = useQuery({
    queryKey: ["defaulted-loans-for-court"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          id,
          user_id,
          loan_amount,
          total_repayment,
          full_name,
          email,
          phone,
          created_at
        `)
        .eq("status", "defaulted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Get loans that don't have court cases yet
  const loansWithoutCases = defaultedLoans?.filter(
    (loan) => !courtCases?.some((c) => c.loan_id === loan.id)
  );

  // Create court case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("court_cases").insert(data);
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["court-cases"] });
      toast.success("Court case created successfully");
      
      // Get selected loan details for notifications
      const selectedLoan = defaultedLoans?.find((l) => l.id === data.loan_id);
      
      if (selectedLoan) {
        // Send notification to borrower
        try {
          await notificationService.sendCourtCaseNotice(
            selectedLoan.user_id,
            selectedLoan.full_name,
            data.case_number || 'Pending',
            data.claim_amount || selectedLoan.total_repayment,
            selectedLoan.phone,
            selectedLoan.email
          );
          toast.success("Borrower notified about court case");
        } catch (err) {
          console.error("Failed to notify borrower:", err);
        }

        // Send notification to lawyer if assigned
        if (data.assigned_lawyer && data.lawyer_contact) {
          try {
            // Determine if lawyer_contact is email or phone
            const isEmail = data.lawyer_contact.includes('@');
            const lawyerEmail = isEmail ? data.lawyer_contact : undefined;
            const lawyerPhone = !isEmail ? data.lawyer_contact : undefined;
            
            await notificationService.sendCustom({
              email: lawyerEmail,
              phone: lawyerPhone,
              message: `NEW CASE ASSIGNMENT: You have been assigned a new case.\n\nBorrower: ${selectedLoan.full_name}\nAmount: K${(data.claim_amount || selectedLoan.total_repayment).toLocaleString()}\nCase Number: ${data.case_number || 'Pending'}\n\nBorrower Contact:\nPhone: ${selectedLoan.phone}\nEmail: ${selectedLoan.email}\n\n- Phindu Finance Legal`,
              subject: `New Case Assignment - ${selectedLoan.full_name}`,
            });
            toast.success("Lawyer notified about new case assignment");
          } catch (err) {
            console.error("Failed to notify lawyer:", err);
          }
        }
      }

      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error("Failed to create court case: " + error.message);
    },
  });

  // Update court case mutation
  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("court_cases").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-cases"] });
      toast.success("Court case updated successfully");
      setIsEditDialogOpen(false);
      setSelectedCase(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update court case: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      case_number: "",
      case_type: "debt_recovery",
      court_name: "",
      court_location: "",
      assigned_lawyer: "",
      lawyer_contact: "",
      lawyer_email: "",
      status: "filed",
      filing_date: "",
      hearing_date: "",
      claim_amount: "",
      legal_fees: "",
      plaintiff_name: settings?.companyInfo?.name || "Phindu Loans",
      notes: "",
    });
    setSelectedLoanId("");
  };

  const handleCreate = () => {
    if (!selectedLoanId) {
      toast.error("Please select a loan");
      return;
    }

    const selectedLoan = defaultedLoans?.find((l) => l.id === selectedLoanId);

    createCaseMutation.mutate({
      loan_id: selectedLoanId,
      case_number: formData.case_number || null,
      case_type: formData.case_type,
      court_name: formData.court_name || null,
      court_location: formData.court_location || null,
      assigned_lawyer: formData.assigned_lawyer || null,
      lawyer_contact: formData.lawyer_contact || null,
      status: formData.status,
      filing_date: formData.filing_date || null,
      hearing_date: formData.hearing_date || null,
      claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : selectedLoan?.total_repayment,
      legal_fees: formData.legal_fees ? parseFloat(formData.legal_fees) : null,
      plaintiff_name: formData.plaintiff_name,
      defendant_name: selectedLoan?.full_name,
      notes: formData.notes || null,
    });
  };

  const handleUpdate = () => {
    if (!selectedCase) return;

    updateCaseMutation.mutate({
      id: selectedCase.id,
      data: {
        case_number: formData.case_number || null,
        case_type: formData.case_type,
        court_name: formData.court_name || null,
        court_location: formData.court_location || null,
        assigned_lawyer: formData.assigned_lawyer || null,
        lawyer_contact: formData.lawyer_contact || null,
        status: formData.status,
        filing_date: formData.filing_date || null,
        hearing_date: formData.hearing_date || null,
        next_hearing_date: formData.hearing_date || null,
        claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : null,
        legal_fees: formData.legal_fees ? parseFloat(formData.legal_fees) : null,
        plaintiff_name: formData.plaintiff_name,
        notes: formData.notes || null,
      },
    });
  };

  const openEditDialog = (courtCase: CourtCase) => {
    setSelectedCase(courtCase);
    setFormData({
      case_number: courtCase.case_number || "",
      case_type: courtCase.case_type,
      court_name: courtCase.court_name || "",
      court_location: courtCase.court_location || "",
      assigned_lawyer: courtCase.assigned_lawyer || "",
      lawyer_contact: courtCase.lawyer_contact || "",
      lawyer_email: "",
      status: courtCase.status,
      filing_date: courtCase.filing_date || "",
      hearing_date: courtCase.hearing_date || courtCase.next_hearing_date || "",
      claim_amount: courtCase.claim_amount?.toString() || "",
      legal_fees: courtCase.legal_fees?.toString() || "",
      plaintiff_name: courtCase.plaintiff_name || "",
      notes: courtCase.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const filteredCases = courtCases?.filter((c) => {
    const matchesSearch =
      c.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.loan_applications?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.assigned_lawyer?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalCases: courtCases?.length || 0,
    activeCases: courtCases?.filter((c) => !["closed", "settled", "dismissed"].includes(c.status)).length || 0,
    totalClaimed: courtCases?.reduce((sum, c) => sum + Number(c.claim_amount || 0), 0) || 0,
    totalRecovered: courtCases?.reduce((sum, c) => sum + Number(c.recovered_amount || 0), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Gavel className="text-primary" size={32} />
              Court Cases
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage legal proceedings for defaulted loans
            </p>
          </div>
          {canManageCourt && (
            <Button className="gradient-primary" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus size={18} className="mr-2" />
              New Court Case
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cases</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalCases}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.activeCases}</p>
                </div>
                <Scale className="text-warning" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Claimed</p>
                  <p className="text-2xl font-bold text-foreground">{currency}{stats.totalClaimed.toLocaleString()}</p>
                </div>
                <DollarSign className="text-destructive" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recovered</p>
                  <p className="text-2xl font-bold text-success">{currency}{stats.totalRecovered.toLocaleString()}</p>
                </div>
                <CheckCircle className="text-success" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by case number, borrower, or lawyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(caseStatusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cases Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCases && filteredCases.length > 0 ? (
          <Card className="glass border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case Details</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Lawyer</TableHead>
                  <TableHead>Claim Amount</TableHead>
                  <TableHead>Next Hearing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((courtCase) => {
                  const config = caseStatusConfig[courtCase.status] || caseStatusConfig.filed;
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={courtCase.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {courtCase.case_number || "Pending Case #"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {courtCase.case_type.replace("_", " ").toUpperCase()}
                          </p>
                          {courtCase.court_name && (
                            <p className="text-xs text-muted-foreground">{courtCase.court_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{courtCase.loan_applications?.full_name || courtCase.defendant_name}</p>
                          <p className="text-xs text-muted-foreground">{courtCase.loan_applications?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {courtCase.assigned_lawyer ? (
                          <div>
                            <p className="font-medium">{courtCase.assigned_lawyer}</p>
                            <p className="text-xs text-muted-foreground">{courtCase.lawyer_contact}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{currency}{Number(courtCase.claim_amount || 0).toLocaleString()}</p>
                        {(courtCase.recovered_amount || 0) > 0 && (
                          <p className="text-xs text-success">
                            Recovered: {currency}{Number(courtCase.recovered_amount).toLocaleString()}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {courtCase.hearing_date || courtCase.next_hearing_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-primary" />
                            <span>{format(new Date(courtCase.hearing_date || courtCase.next_hearing_date!), "MMM dd, yyyy")}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.color} border`}>
                          <StatusIcon size={12} className="mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCase(courtCase);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye size={16} />
                          </Button>
                          {canManageCourt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(courtCase)}
                            >
                              <Edit size={16} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No court cases found</p>
              {loansWithoutCases && loansWithoutCases.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {loansWithoutCases.length} defaulted loan(s) available for court action
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Case Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Court Case</DialogTitle>
              <DialogDescription>
                File a new court case for a defaulted loan
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Loan Selection */}
              <div className="space-y-2">
                <Label>Select Defaulted Loan *</Label>
                <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a loan to file case for" />
                  </SelectTrigger>
                  <SelectContent>
                    {loansWithoutCases?.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id}>
                        {loan.full_name} - {currency}{Number(loan.loan_amount).toLocaleString()} (Owed: {currency}{Number(loan.total_repayment || loan.loan_amount).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!loansWithoutCases || loansWithoutCases.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No defaulted loans available. All defaulted loans already have court cases.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Case Number</Label>
                  <Input
                    value={formData.case_number}
                    onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                    placeholder="e.g., CASE/2026/001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Case Type *</Label>
                  <Select
                    value={formData.case_type}
                    onValueChange={(v) => setFormData({ ...formData, case_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debt_recovery">Debt Recovery</SelectItem>
                      <SelectItem value="civil_suit">Civil Suit</SelectItem>
                      <SelectItem value="small_claims">Small Claims</SelectItem>
                      <SelectItem value="summary_judgment">Summary Judgment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Court Name</Label>
                  <Input
                    value={formData.court_name}
                    onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
                    placeholder="e.g., Subordinate Court"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Court Location</Label>
                  <Input
                    value={formData.court_location}
                    onChange={(e) => setFormData({ ...formData, court_location: e.target.value })}
                    placeholder="e.g., Lusaka"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Lawyer</Label>
                  <Input
                    value={formData.assigned_lawyer}
                    onChange={(e) => setFormData({ ...formData, assigned_lawyer: e.target.value })}
                    placeholder="Lawyer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lawyer Contact</Label>
                  <Input
                    value={formData.lawyer_contact}
                    onChange={(e) => setFormData({ ...formData, lawyer_contact: e.target.value })}
                    placeholder="Phone / Email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Filing Date</Label>
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
                <div className="space-y-2">
                  <Label>Claim Amount ({currency})</Label>
                  <Input
                    type="number"
                    value={formData.claim_amount}
                    onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                    placeholder="Total amount being claimed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Legal Fees ({currency})</Label>
                  <Input
                    type="number"
                    value={formData.legal_fees}
                    onChange={(e) => setFormData({ ...formData, legal_fees: e.target.value })}
                    placeholder="Legal fees"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional case notes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gradient-primary"
                onClick={handleCreate}
                disabled={!selectedLoanId || createCaseMutation.isPending}
              >
                {createCaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Case Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Court Case</DialogTitle>
              <DialogDescription>
                Update case details for {selectedCase?.loan_applications?.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Case Number</Label>
                  <Input
                    value={formData.case_number}
                    onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Case Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(caseStatusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Court Name</Label>
                  <Input
                    value={formData.court_name}
                    onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Court Location</Label>
                  <Input
                    value={formData.court_location}
                    onChange={(e) => setFormData({ ...formData, court_location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Lawyer</Label>
                  <Input
                    value={formData.assigned_lawyer}
                    onChange={(e) => setFormData({ ...formData, assigned_lawyer: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lawyer Contact</Label>
                  <Input
                    value={formData.lawyer_contact}
                    onChange={(e) => setFormData({ ...formData, lawyer_contact: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Filing Date</Label>
                  <Input
                    type="date"
                    value={formData.filing_date}
                    onChange={(e) => setFormData({ ...formData, filing_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Next Hearing Date</Label>
                  <Input
                    type="date"
                    value={formData.hearing_date}
                    onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Claim Amount ({currency})</Label>
                  <Input
                    type="number"
                    value={formData.claim_amount}
                    onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Legal Fees ({currency})</Label>
                  <Input
                    type="number"
                    value={formData.legal_fees}
                    onChange={(e) => setFormData({ ...formData, legal_fees: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gradient-primary"
                onClick={handleUpdate}
                disabled={updateCaseMutation.isPending}
              >
                {updateCaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Case Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gavel className="text-primary" size={20} />
                Case Details: {selectedCase?.case_number || "Pending"}
              </DialogTitle>
            </DialogHeader>

            {selectedCase && (
              <div className="space-y-6 py-4">
                {/* Case Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={`${caseStatusConfig[selectedCase.status]?.color || ""} border`}>
                      {caseStatusConfig[selectedCase.status]?.label || selectedCase.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Case Type</p>
                    <p className="font-medium">{selectedCase.case_type.replace("_", " ").toUpperCase()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Court</p>
                    <p className="font-medium">{selectedCase.court_name || "Not specified"}</p>
                    {selectedCase.court_location && (
                      <p className="text-sm text-muted-foreground">{selectedCase.court_location}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Claim Amount</p>
                    <p className="font-bold text-lg">{currency}{Number(selectedCase.claim_amount || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Plaintiff</p>
                    <p className="font-medium">{selectedCase.plaintiff_name || settings?.companyInfo?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Defendant</p>
                    <p className="font-medium">{selectedCase.loan_applications?.full_name || selectedCase.defendant_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedCase.loan_applications?.phone}</p>
                  </div>
                </div>

                {/* Lawyer */}
                {selectedCase.assigned_lawyer && (
                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                    <Briefcase className="text-primary" size={24} />
                    <div>
                      <p className="font-medium">{selectedCase.assigned_lawyer}</p>
                      <p className="text-sm text-muted-foreground">{selectedCase.lawyer_contact}</p>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Filed</p>
                    <p className="font-medium">
                      {selectedCase.filing_date ? format(new Date(selectedCase.filing_date), "MMM dd, yyyy") : "Not filed"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Next Hearing</p>
                    <p className="font-medium">
                      {selectedCase.hearing_date || selectedCase.next_hearing_date
                        ? format(new Date(selectedCase.hearing_date || selectedCase.next_hearing_date!), "MMM dd, yyyy")
                        : "Not scheduled"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Legal Fees</p>
                    <p className="font-medium">{currency}{Number(selectedCase.legal_fees || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Notes */}
                {selectedCase.notes && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedCase.notes}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              {canManageCourt && (
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  if (selectedCase) openEditDialog(selectedCase);
                }}>
                  <Edit size={16} className="mr-2" />
                  Edit Case
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCourtCases;
