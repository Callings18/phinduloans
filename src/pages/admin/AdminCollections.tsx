import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { LegacyAdminPathBanner } from "@/components/admin/LegacyAdminPathBanner";
import { PageHeader, StatsGrid } from "@/components/layout/PageShell";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Phone,
  Calendar,
  AlertCircle,
  MessageSquare,
  UserX,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  FileText,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Mail,
  MapPin,
  ArrowUpCircle,
  Download,
  Eye,
  Users,
  Bot,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { format, differenceInDays, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { downloadDemandLetter } from "@/utils/generateDemandLetter";
import CollectionsAutomation from "@/components/admin/CollectionsAutomation";

interface OverdueItem {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  penalty_amount?: number;
  loan: {
    id: string;
    loan_amount: number;
    total_repayment: number;
    status: string;
    user_id: string;
    full_name: string;
    phone: string;
    email: string;
    address?: string;
    city?: string;
  };
}

interface PTPItem {
  id: string;
  loan_id: string;
  promise_date: string;
  promise_amount: number;
  activity_type: string;
  notes: string;
  outcome: string;
  created_at: string;
  loan?: {
    full_name: string;
    phone: string;
    email: string;
    loan_amount: number;
  };
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
}

const AdminCollections = () => {
  const { can } = usePermissions();
  const canManageCollections = can("collections", "manage");
  const [activeTab, setActiveTab] = useState("overdue");
  const [searchQuery, setSearchQuery] = useState("");
  const [daysOverdueFilter, setDaysOverdueFilter] = useState("all");
  const [selectedRepayment, setSelectedRepayment] = useState<OverdueItem | null>(null);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isDemandLetterDialogOpen, setIsDemandLetterDialogOpen] = useState(false);
  const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState("");
  const [assignmentPriority, setAssignmentPriority] = useState("normal");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [demandLetterType, setDemandLetterType] = useState<"first_notice" | "second_notice" | "final_notice" | "legal_notice">("first_notice");
  const [escalationLevel, setEscalationLevel] = useState("2");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [activityForm, setActivityForm] = useState({
    activity_type: "phone_call",
    notes: "",
    outcome: "promised_to_pay",
    promise_date: "",
    promise_amount: "",
    follow_up_date: "",
    contact_method: "phone",
  });

  const queryClient = useQueryClient();

  // Fetch overdue repayments
  const { data: overdueRepayments, isLoading } = useQuery({
    queryKey: ["overdue-repayments"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("loan_repayments")
        .select(`
          *,
          loan:loan_id (
            id,
            loan_amount,
            total_repayment,
            status,
            user_id,
            full_name,
            phone,
            email,
            address,
            city
          )
        `)
        .lt("due_date", today)
        .not("status", "in", '("paid","cancelled")')
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as OverdueItem[];
    },
  });

  // Fetch PTPs (Promise to Pay) - activities with upcoming promise dates
  const { data: ptpItems, isLoading: ptpLoading } = useQuery({
    queryKey: ["ptp-items"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("collection_activities")
        .select(`
          *,
          loan:loan_id (
            full_name,
            phone,
            email,
            loan_amount
          )
        `)
        .gte("promise_date", today)
        .order("promise_date", { ascending: true });

      if (error) throw error;
      return data as PTPItem[];
    },
  });

  // Fetch collection assignments
  const { data: assignments } = useQuery({
    queryKey: ["collection-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_assignments")
        .select(`
          *,
          loan:loan_id (
            full_name,
            phone,
            loan_amount,
            status
          )
        `)
        .eq("status", "active")
        .order("priority", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch demand letters history
  const { data: demandLetters } = useQuery({
    queryKey: ["demand-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_letters")
        .select(`
          *,
          loan:loan_id (
            full_name,
            phone
          )
        `)
        .order("generated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch staff for assignment
  const { data: staff } = useQuery({
    queryKey: ["staff-collectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (error) throw error;
      return data as StaffMember[];
    },
  });

  // Log Activity Mutation
  const logActivityMutation = useMutation({
    mutationFn: async (data: typeof activityForm) => {
      if (!selectedRepayment) throw new Error("No repayment selected");
      const user = (await supabase.auth.getUser()).data.user;
      
      const { error } = await supabase.from("collection_activities").insert({
        loan_id: selectedRepayment.loan_id,
        repayment_id: selectedRepayment.id,
        staff_id: user?.id,
        activity_type: data.activity_type,
        notes: data.notes,
        outcome: data.outcome,
        promise_date: data.promise_date || null,
        promise_amount: data.promise_amount ? Number(data.promise_amount) : null,
        follow_up_date: data.follow_up_date || null,
        contact_method: data.contact_method,
        ptp_status: data.outcome === "promised_to_pay" ? "pending" : null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overdue-repayments"] });
      queryClient.invalidateQueries({ queryKey: ["ptp-items"] });
      toast.success("Collection activity logged successfully");
      setIsActivityDialogOpen(false);
      resetActivityForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log activity");
    },
  });

  // Assign Collector Mutation
  const assignCollectorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment || !selectedCollector) throw new Error("Missing data");
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.from("collection_assignments").insert({
        loan_id: selectedRepayment.loan_id,
        collector_id: selectedCollector,
        assigned_by: user?.id,
        priority: assignmentPriority,
        notes: assignmentNotes,
        status: "active",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-assignments"] });
      toast.success("Collector assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedCollector("");
      setAssignmentPriority("normal");
      setAssignmentNotes("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign collector");
    },
  });

  // Generate Demand Letter
  const generateDemandLetterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment) throw new Error("No loan selected");
      const user = (await supabase.auth.getUser()).data.user;

      // Get overdue stats for this loan
      const { data: overdueData } = await supabase
        .from("loan_repayments")
        .select("amount, penalty_amount, due_date")
        .eq("loan_id", selectedRepayment.loan_id)
        .eq("status", "pending")
        .lt("due_date", new Date().toISOString().split("T")[0]);

      const overdueAmount = overdueData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const penaltyAmount = overdueData?.reduce((sum, r) => sum + Number(r.penalty_amount || 0), 0) || 0;
      const oldestOverdue = overdueData?.sort((a, b) => 
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      )[0];

      // Generate PDF
      downloadDemandLetter({
        borrowerName: selectedRepayment.loan.full_name,
        borrowerAddress: `${selectedRepayment.loan.address || ""}, ${selectedRepayment.loan.city || ""}`.trim() || "Address on file",
        borrowerPhone: selectedRepayment.loan.phone,
        borrowerEmail: selectedRepayment.loan.email,
        loanId: selectedRepayment.loan_id,
        loanAmount: selectedRepayment.loan.loan_amount,
        totalRepayment: selectedRepayment.loan.total_repayment,
        overdueAmount: overdueAmount,
        overdueCount: overdueData?.length || 0,
        penaltyAmount: penaltyAmount,
        oldestOverdueDate: oldestOverdue?.due_date || new Date().toISOString(),
        letterType: demandLetterType,
      });

      // Log the demand letter
      const { error } = await supabase.from("demand_letters").insert({
        loan_id: selectedRepayment.loan_id,
        letter_type: demandLetterType,
        generated_by: user?.id,
        amount_demanded: overdueAmount + penaltyAmount,
        due_date: format(addDays(new Date(), demandLetterType === "legal_notice" ? 2 : demandLetterType === "final_notice" ? 3 : demandLetterType === "second_notice" ? 5 : 7), "yyyy-MM-dd"),
      });

      if (error) throw error;

      // Also log as collection activity
      const { error: activityErr } = await supabase.from("collection_activities").insert({
        loan_id: selectedRepayment.loan_id,
        repayment_id: selectedRepayment.id,
        staff_id: user?.id,
        activity_type: "demand_letter",
        notes: `${demandLetterType.replace("_", " ")} generated and downloaded`,
        outcome: "letter_issued",
      });
      if (activityErr) throw activityErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-letters"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-repayments"] });
      toast.success("Demand letter generated and downloaded");
      setIsDemandLetterDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate letter");
    },
  });

  // Escalate Account Mutation
  const escalateAccountMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment) throw new Error("No loan selected");
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.from("collection_activities").insert({
        loan_id: selectedRepayment.loan_id,
        repayment_id: selectedRepayment.id,
        staff_id: user?.id,
        activity_type: "escalation",
        notes: escalationNotes,
        outcome: `escalated_to_level_${escalationLevel}`,
        escalation_level: Number(escalationLevel),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overdue-repayments"] });
      toast.success(`Account escalated to level ${escalationLevel}`);
      setIsEscalateDialogOpen(false);
      setEscalationNotes("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to escalate account");
    },
  });

  const resetActivityForm = () => {
    setActivityForm({
      activity_type: "phone_call",
      notes: "",
      outcome: "promised_to_pay",
      promise_date: "",
      promise_amount: "",
      follow_up_date: "",
      contact_method: "phone",
    });
  };

  const handleLogActivity = () => {
    if (!activityForm.notes) {
      toast.error("Please enter notes");
      return;
    }
    logActivityMutation.mutate(activityForm);
  };

  // Filtering
  const filteredRepayments = overdueRepayments?.filter((item) => {
    const matchesSearch =
      item.loan.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.loan.phone?.includes(searchQuery);

    if (daysOverdueFilter === "all") return matchesSearch;

    const days = differenceInDays(new Date(), new Date(item.due_date));
    if (daysOverdueFilter === "1-30") return matchesSearch && days <= 30;
    if (daysOverdueFilter === "31-60") return matchesSearch && days > 30 && days <= 60;
    if (daysOverdueFilter === "61-90") return matchesSearch && days > 60 && days <= 90;
    if (daysOverdueFilter === "90+") return matchesSearch && days > 90;

    return matchesSearch;
  });

  // Stats
  const totalOverdueAmount = overdueRepayments?.reduce((sum, item) => sum + Number(item.amount) + Number(item.penalty_amount || 0), 0) || 0;
  const ptpDueToday = ptpItems?.filter((p) => isToday(new Date(p.promise_date))).length || 0;
  const ptpDueTomorrow = ptpItems?.filter((p) => isTomorrow(new Date(p.promise_date))).length || 0;
  const ptpOverdue = ptpItems?.filter((p) => isPast(new Date(p.promise_date)) && !isToday(new Date(p.promise_date))).length || 0;

  const getPTPStatusBadge = (promiseDate: string) => {
    if (isToday(new Date(promiseDate))) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Due Today</Badge>;
    }
    if (isTomorrow(new Date(promiseDate))) {
      return <Badge className="bg-info/20 text-info border-info/30">Due Tomorrow</Badge>;
    }
    if (isPast(new Date(promiseDate))) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Broken PTP</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/30">Upcoming</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Collections Management"
          description="Track overdue accounts, PTPs, and recovery actions"
        />
        <LegacyAdminPathBanner page="collections" />

        {/* Stats Summary */}
        <StatsGrid className="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center text-destructive">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Overdue</p>
                <p className="text-xl font-bold text-foreground">K{totalOverdueAmount.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                <UserX size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Accounts at Risk</p>
                <p className="text-xl font-bold text-foreground">{overdueRepayments?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center text-info">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PTPs Today</p>
                <p className="text-xl font-bold text-foreground">{ptpDueToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PTPs Tomorrow</p>
                <p className="text-xl font-bold text-foreground">{ptpDueTomorrow}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center text-destructive">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Broken PTPs</p>
                <p className="text-xl font-bold text-foreground">{ptpOverdue}</p>
              </div>
            </CardContent>
          </Card>
        </StatsGrid>

        {/* Automation Panel */}
        <CollectionsAutomation 
          overdueRepayments={overdueRepayments || []} 
          ptpItems={ptpItems || []} 
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="overdue">
              <AlertCircle size={16} className="mr-2" /> Overdue
            </TabsTrigger>
            <TabsTrigger value="ptp">
              <Calendar size={16} className="mr-2" /> PTP Dashboard
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <Users size={16} className="mr-2" /> Assignments
            </TabsTrigger>
            <TabsTrigger value="letters">
              <FileText size={16} className="mr-2" /> Demand Letters
            </TabsTrigger>
          </TabsList>

          {/* Overdue Tab */}
          <TabsContent value="overdue" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      placeholder="Search by borrower name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={daysOverdueFilter} onValueChange={setDaysOverdueFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <Filter size={16} className="mr-2" />
                      <SelectValue placeholder="Overdue Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Overdue</SelectItem>
                      <SelectItem value="1-30">1 - 30 Days</SelectItem>
                      <SelectItem value="31-60">31 - 60 Days</SelectItem>
                      <SelectItem value="61-90">61 - 90 Days</SelectItem>
                      <SelectItem value="90+">90+ Days (Write-off risk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Overdue List */}
            <div className="grid grid-cols-1 gap-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary h-8 w-8" />
                </div>
              ) : filteredRepayments && filteredRepayments.length > 0 ? (
                filteredRepayments.map((item) => {
                  const days = differenceInDays(new Date(), new Date(item.due_date));
                  let riskColor = "bg-warning/20 text-warning border-warning/30";
                  if (days > 30) riskColor = "bg-orange-500/20 text-orange-500 border-orange-500/30";
                  if (days > 60) riskColor = "bg-destructive/20 text-destructive border-destructive/30";

                  return (
                    <Card key={item.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${riskColor}`}>
                              <AlertCircle size={24} />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-semibold text-lg text-foreground">{item.loan.full_name}</h4>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone size={14} />
                                  {item.loan.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Mail size={14} />
                                  {item.loan.email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  Due: {format(new Date(item.due_date), "dd MMM yyyy")}
                                </span>
                                <Badge variant="outline" className={riskColor}>
                                  {days} Days Overdue
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="text-right sm:text-left">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Due</p>
                              <p className="text-2xl font-bold text-destructive">
                                K{(Number(item.amount) + Number(item.penalty_amount || 0)).toLocaleString()}
                              </p>
                              {item.penalty_amount && Number(item.penalty_amount) > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  incl. K{Number(item.penalty_amount).toLocaleString()} penalty
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canManageCollections && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRepayment(item);
                                      setIsActivityDialogOpen(true);
                                    }}
                                  >
                                    <MessageSquare size={14} className="mr-1" /> Log
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRepayment(item);
                                      setIsAssignDialogOpen(true);
                                    }}
                                  >
                                    <UserPlus size={14} className="mr-1" /> Assign
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRepayment(item);
                                      setIsDemandLetterDialogOpen(true);
                                    }}
                                  >
                                    <FileText size={14} className="mr-1" /> Letter
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedRepayment(item);
                                      setIsEscalateDialogOpen(true);
                                    }}
                                  >
                                    <ArrowUpCircle size={14} className="mr-1" /> Escalate
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="border-dashed py-12">
                  <CardContent className="flex flex-col items-center text-center">
                    <CheckCircle className="h-12 w-12 text-success mb-4" />
                    <h3 className="text-lg font-medium">No overdue repayments</h3>
                    <p className="text-muted-foreground">The portfolio is looking healthy!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* PTP Dashboard Tab */}
          <TabsContent value="ptp" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar size={20} /> Promise to Pay Dashboard
                </CardTitle>
                <CardDescription>Track and follow up on customer payment promises</CardDescription>
              </CardHeader>
              <CardContent>
                {ptpLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                  </div>
                ) : ptpItems && ptpItems.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Promise Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ptpItems.map((ptp) => (
                          <TableRow
                            key={ptp.id}
                            className={
                              isToday(new Date(ptp.promise_date))
                                ? "bg-warning/5"
                                : isPast(new Date(ptp.promise_date))
                                ? "bg-destructive/5"
                                : ""
                            }
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{ptp.loan?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{ptp.loan?.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell>{format(new Date(ptp.promise_date), "MMM dd, yyyy")}</TableCell>
                            <TableCell className="font-semibold">
                              K{Number(ptp.promise_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>{getPTPStatusBadge(ptp.promise_date)}</TableCell>
                            <TableCell className="max-w-xs truncate">{ptp.notes}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Phone size={14} className="mr-1" /> Follow Up
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h3 className="text-lg font-medium">No Active PTPs</h3>
                    <p className="text-muted-foreground">No promises to pay have been recorded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} /> Collection Assignments
                </CardTitle>
                <CardDescription>View and manage collector workload</CardDescription>
              </CardHeader>
              <CardContent>
                {assignments && assignments.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loan</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Assigned At</TableHead>
                          <TableHead>Last Contact</TableHead>
                          <TableHead>Next Action</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((assignment: any) => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{assignment.loan?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{assignment.loan?.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  assignment.priority === "high"
                                    ? "bg-destructive/20 text-destructive"
                                    : assignment.priority === "urgent"
                                    ? "bg-warning/20 text-warning"
                                    : "bg-muted"
                                }
                              >
                                {assignment.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(assignment.assigned_at), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              {assignment.last_contact_at
                                ? format(new Date(assignment.last_contact_at), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {assignment.next_action_date
                                ? format(new Date(assignment.next_action_date), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{assignment.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h3 className="text-lg font-medium">No Active Assignments</h3>
                    <p className="text-muted-foreground">Assign collectors to overdue accounts to track here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Demand Letters Tab */}
          <TabsContent value="letters" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} /> Demand Letters History
                </CardTitle>
                <CardDescription>Track all generated demand letters</CardDescription>
              </CardHeader>
              <CardContent>
                {demandLetters && demandLetters.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Letter Type</TableHead>
                          <TableHead>Amount Demanded</TableHead>
                          <TableHead>Generated</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Response</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demandLetters.map((letter: any) => (
                          <TableRow key={letter.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{letter.loan?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{letter.loan?.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  letter.letter_type === "legal_notice"
                                    ? "bg-destructive/20 text-destructive"
                                    : letter.letter_type === "final_notice"
                                    ? "bg-warning/20 text-warning"
                                    : "bg-muted"
                                }
                              >
                                {letter.letter_type?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">
                              K{Number(letter.amount_demanded || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>{format(new Date(letter.generated_at), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              {letter.due_date ? format(new Date(letter.due_date), "MMM dd, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {letter.response_received ? (
                                <Badge className="bg-success/20 text-success">Received</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h3 className="text-lg font-medium">No Demand Letters</h3>
                    <p className="text-muted-foreground">Generated demand letters will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Log Activity Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Collection Activity</DialogTitle>
            <DialogDescription>
              Record the outcome of contact with {selectedRepayment?.loan.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select
                  value={activityForm.activity_type}
                  onValueChange={(v) => setActivityForm({ ...activityForm, activity_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="sms">SMS Sent</SelectItem>
                    <SelectItem value="email">Email Sent</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select
                  value={activityForm.outcome}
                  onValueChange={(v) => setActivityForm({ ...activityForm, outcome: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promised_to_pay">Promised to Pay (PTP)</SelectItem>
                    <SelectItem value="requested_extension">Requested Extension</SelectItem>
                    <SelectItem value="unreachable">Unreachable</SelectItem>
                    <SelectItem value="refused_to_pay">Refused to Pay</SelectItem>
                    <SelectItem value="disputed">Disputed Amount</SelectItem>
                    <SelectItem value="partial_payment">Partial Payment Made</SelectItem>
                    <SelectItem value="full_payment">Full Payment Made</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activityForm.outcome === "promised_to_pay" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Promise Date</Label>
                  <Input
                    type="date"
                    value={activityForm.promise_date}
                    onChange={(e) => setActivityForm({ ...activityForm, promise_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Promise Amount</Label>
                  <Input
                    type="number"
                    value={activityForm.promise_amount}
                    onChange={(e) => setActivityForm({ ...activityForm, promise_amount: e.target.value })}
                    placeholder="Amount promised"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes *</Label>
              <Textarea
                placeholder="Details of the conversation..."
                value={activityForm.notes}
                onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Next Follow-up Date</Label>
              <Input
                type="date"
                value={activityForm.follow_up_date}
                onChange={(e) => setActivityForm({ ...activityForm, follow_up_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogActivity} disabled={logActivityMutation.isPending}>
              {logActivityMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Save Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Collector Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={20} /> Assign Collector
            </DialogTitle>
            <DialogDescription>
              Assign a collector to follow up on {selectedRepayment?.loan.full_name}'s account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Collector</Label>
              <Select value={selectedCollector} onValueChange={setSelectedCollector}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={assignmentPriority} onValueChange={setAssignmentPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Instructions for the collector..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => assignCollectorMutation.mutate()} disabled={assignCollectorMutation.isPending || !selectedCollector}>
              {assignCollectorMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Assign Collector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demand Letter Dialog */}
      <Dialog open={isDemandLetterDialogOpen} onOpenChange={setIsDemandLetterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} /> Generate Demand Letter
            </DialogTitle>
            <DialogDescription>
              Create a formal demand letter for {selectedRepayment?.loan.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Letter Type</Label>
              <Select value={demandLetterType} onValueChange={(v: any) => setDemandLetterType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_notice">First Notice (Friendly Reminder)</SelectItem>
                  <SelectItem value="second_notice">Second Notice (Firm Reminder)</SelectItem>
                  <SelectItem value="final_notice">Final Notice (Urgent)</SelectItem>
                  <SelectItem value="legal_notice">Legal Notice (Intent to Sue)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Letter Preview:</p>
              <p className="text-xs text-muted-foreground">
                {demandLetterType === "first_notice" && "A friendly reminder with 7-day deadline. Warns of potential penalties."}
                {demandLetterType === "second_notice" && "A firm reminder with 5-day deadline. Warns of escalation."}
                {demandLetterType === "final_notice" && "An urgent notice with 3-day deadline. Warns of legal action."}
                {demandLetterType === "legal_notice" && "A legal notice with 2-day deadline. States intent to proceed with legal action."}
              </p>
            </div>

            {(demandLetterType === "final_notice" || demandLetterType === "legal_notice") && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-destructive mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    This is a serious escalation. Ensure previous notices have been sent and documented.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDemandLetterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => generateDemandLetterMutation.mutate()} disabled={generateDemandLetterMutation.isPending}>
              {generateDemandLetterMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              <Download size={14} className="mr-1" /> Generate & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate Account Dialog */}
      <Dialog open={isEscalateDialogOpen} onOpenChange={setIsEscalateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ArrowUpCircle size={20} /> Escalate Account
            </DialogTitle>
            <DialogDescription>
              Escalate {selectedRepayment?.loan.full_name}'s account to a higher collection level
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Escalation Level</Label>
              <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Level 2 - Senior Collections</SelectItem>
                  <SelectItem value="3">Level 3 - Recovery Team</SelectItem>
                  <SelectItem value="4">Level 4 - Legal Department</SelectItem>
                  <SelectItem value="5">Level 5 - External Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Escalation Levels:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Level 2: Senior collector involvement</li>
                <li>• Level 3: Dedicated recovery team</li>
                <li>• Level 4: Legal action preparation</li>
                <li>• Level 5: External debt collection agency</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Escalation Reason *</Label>
              <Textarea
                placeholder="Explain why this account needs escalation..."
                value={escalationNotes}
                onChange={(e) => setEscalationNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEscalateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => escalateAccountMutation.mutate()}
              disabled={escalateAccountMutation.isPending || !escalationNotes}
            >
              {escalateAccountMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Escalate Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCollections;
