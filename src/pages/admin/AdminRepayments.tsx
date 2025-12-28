import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays, isAfter } from "date-fns";
import {
  Receipt,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Plus,
  DollarSign,
  Calendar,
  User,
  Wallet,
  CreditCard,
  Phone,
  Building,
  Banknote,
  Download,
  FileText,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface Repayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  transaction_reference: string | null;
  installment_number: number | null;
  loan_applications?: {
    full_name: string;
    email: string;
    phone: string;
    loan_amount: number;
  };
}

const AdminRepayments = () => {
  const { data: settings } = useSystemSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [paymentData, setPaymentData] = useState({
    payment_method: "mobile_money",
    transaction_reference: "",
  });

  const queryClient = useQueryClient();

  // Fetch all repayments
  const { data: repayments, isLoading } = useQuery({
    queryKey: ["admin-repayments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select(`
          *,
          loan_applications (
            full_name,
            email,
            phone,
            loan_amount
          )
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Repayment[];
    },
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ repaymentId, paymentMethod, transactionRef }: { repaymentId: string; paymentMethod: string; transactionRef: string }) => {
      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_method: paymentMethod,
          transaction_reference: transactionRef || `PAY-${Date.now()}`,
        })
        .eq("id", repaymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-repayments"] });
      toast.success("Payment recorded successfully");
      setIsRecordPaymentOpen(false);
      setSelectedRepayment(null);
      setPaymentData({ payment_method: "mobile_money", transaction_reference: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const handleRecordPayment = (repayment: Repayment) => {
    setSelectedRepayment(repayment);
    setIsRecordPaymentOpen(true);
  };

  const handleDownloadReceipt = async (repayment: Repayment) => {
    try {
      // Get loan details and calculate totals
      const { data: allRepayments } = await supabase
        .from('loan_repayments')
        .select('amount, status')
        .eq('loan_id', repayment.loan_id);

      const { data: loan } = await supabase
        .from('loan_applications')
        .select('loan_amount, total_repayment, loan_term_months')
        .eq('id', repayment.loan_id)
        .single();

      const totalPaid = allRepayments
        ?.filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      const outstandingBalance = (loan?.total_repayment || 0) - totalPaid;

      downloadRepaymentReceipt({
        borrowerName: repayment.loan_applications?.full_name || 'Unknown',
        borrowerPhone: repayment.loan_applications?.phone || '',
        borrowerEmail: repayment.loan_applications?.email || '',
        loanReference: `LOAN-${repayment.loan_id.substring(0, 8).toUpperCase()}`,
        loanAmount: loan?.loan_amount || 0,
        repaymentAmount: Number(repayment.amount),
        paymentDate: repayment.paid_date || new Date().toISOString(),
        paymentMethod: repayment.payment_method || 'cash',
        transactionReference: repayment.transaction_reference || `TXN-${Date.now()}`,
        installmentNumber: repayment.installment_number || 1,
        totalInstallments: loan?.loan_term_months || 1,
        totalPaid,
        outstandingBalance,
        companyName: settings?.companyInfo?.name || 'PHINDU Finance',
        companyAddress: settings?.companyInfo?.address || 'Lusaka, Zambia',
        companyPhone: settings?.companyInfo?.support_phone || '+260 97 1234567',
      });

      toast.success('Receipt downloaded successfully');
    } catch (error: any) {
      toast.error('Failed to generate receipt');
    }
  };

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepayment) return;
    
    recordPaymentMutation.mutate({
      repaymentId: selectedRepayment.id,
      paymentMethod: paymentData.payment_method,
      transactionRef: paymentData.transaction_reference,
    });
  };

  const getStatusInfo = (repayment: Repayment) => {
    const today = new Date();
    const dueDate = new Date(repayment.due_date);
    const isOverdue = repayment.status === "pending" && isAfter(today, dueDate);
    const daysOverdue = isOverdue ? differenceInDays(today, dueDate) : 0;

    if (repayment.status === "paid") {
      return { status: "paid", color: "bg-success/20 text-success border-success/30", icon: CheckCircle };
    }
    if (isOverdue) {
      return { 
        status: `${daysOverdue} days overdue`, 
        color: "bg-destructive/20 text-destructive border-destructive/30", 
        icon: AlertTriangle 
      };
    }
    return { status: "pending", color: "bg-warning/20 text-warning border-warning/30", icon: Clock };
  };

  const filteredRepayments = repayments?.filter((rep) => {
    const matchesSearch =
      rep.loan_applications?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const today = new Date();
    const dueDate = new Date(rep.due_date);
    const isOverdue = rep.status === "pending" && isAfter(today, dueDate);
    
    const matchesStatus = 
      statusFilter === "all" || 
      rep.status === statusFilter ||
      (statusFilter === "overdue" && isOverdue);
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const today = new Date();
  const stats = {
    total: repayments?.length || 0,
    pending: repayments?.filter((r) => r.status === "pending").length || 0,
    paid: repayments?.filter((r) => r.status === "paid").length || 0,
    overdue: repayments?.filter((r) => 
      r.status === "pending" && isAfter(today, new Date(r.due_date))
    ).length || 0,
    totalCollected: repayments
      ?.filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + Number(r.amount), 0) || 0,
    totalPending: repayments
      ?.filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + Number(r.amount), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Repayments</h1>
          <p className="text-muted-foreground mt-1">
            Track and record loan repayments
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Receipt className="text-primary-foreground" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Clock className="text-warning" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="text-success" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.paid}</p>
                <p className="text-sm text-muted-foreground">Paid</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="text-destructive" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Wallet className="text-emerald-400" size={24} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">K{stats.totalCollected.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Collected</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Banknote className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">K{stats.totalPending.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Repayments Table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Repayment Records</CardTitle>
            <CardDescription>All scheduled loan repayments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRepayments?.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No repayments found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Repayments will appear when loans are disbursed"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRepayments?.map((rep) => {
                    const statusInfo = getStatusInfo(rep);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={rep.id} className={statusInfo.status.includes("overdue") ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{rep.installment_number || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="text-primary" size={18} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{rep.loan_applications?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{rep.loan_applications?.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-foreground">K{Number(rep.amount).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            {format(new Date(rep.due_date), "MMM dd, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo.color}>
                            <StatusIcon size={12} className="mr-1" />
                            {statusInfo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rep.payment_method ? (
                            <div className="flex items-center gap-2 text-sm">
                              {rep.payment_method === "mobile_money" && <Phone size={14} />}
                              {rep.payment_method === "bank_transfer" && <Building size={14} />}
                              {rep.payment_method === "cash" && <Banknote size={14} />}
                              <span className="capitalize">{rep.payment_method.replace(/_/g, " ")}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {rep.transaction_reference || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {rep.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleRecordPayment(rep)}
                                className="gradient-primary"
                              >
                                <Plus size={14} className="mr-1" />
                                Record Payment
                              </Button>
                            )}
                            {rep.status === "paid" && (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {rep.paid_date ? format(new Date(rep.paid_date), "MMM dd") : "-"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadReceipt(rep)}
                                  title="Download Receipt"
                                >
                                  <Download size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Record Payment Dialog */}
        <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a repayment for {selectedRepayment?.loan_applications?.full_name}
              </DialogDescription>
            </DialogHeader>
            {selectedRepayment && (
              <form onSubmit={submitPayment} className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Due</span>
                    <span className="font-bold text-foreground">K{Number(selectedRepayment.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="text-foreground">{format(new Date(selectedRepayment.due_date), "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installment</span>
                    <span className="text-foreground">#{selectedRepayment.installment_number || "-"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select
                    value={paymentData.payment_method}
                    onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          Mobile Money
                        </div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2">
                          <Building size={14} />
                          Bank Transfer
                        </div>
                      </SelectItem>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <Banknote size={14} />
                          Cash
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Transaction Reference (Optional)</Label>
                  <Input
                    value={paymentData.transaction_reference}
                    onChange={(e) => setPaymentData({ ...paymentData, transaction_reference: e.target.value })}
                    placeholder="Enter reference number"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsRecordPaymentOpen(false);
                      setSelectedRepayment(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-primary"
                    disabled={recordPaymentMutation.isPending}
                  >
                    {recordPaymentMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle size={16} className="mr-2" />
                    Confirm Payment
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRepayments;