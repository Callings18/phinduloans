import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Search,
  FileX,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Loader2,
  Eye,
  RefreshCw,
  Banknote,
  TrendingDown,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

const AdminWriteOffs = () => {
  const { can } = usePermissions();
  const canManageWriteOffs = can("writeoffs", "manage");
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWriteOff, setSelectedWriteOff] = useState<any>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [recoveryNotes, setRecoveryNotes] = useState("");
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch all write-offs
  const { data: writeOffs, isLoading } = useQuery({
    queryKey: ["admin-writeoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_writeoffs")
        .select(`
          *,
          loan:loan_id (
            id,
            full_name,
            phone,
            email,
            loan_amount,
            total_repayment,
            status,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Approve write-off mutation - atomic RPC
  const approveWriteOffMutation = useMutation({
    mutationFn: async (writeOffId: string) => {
      if (!canManageWriteOffs) throw new Error("Permission denied: write-offs manage");
      const { data, error } = await supabase.rpc("admin_approve_loan_writeoff", {
        p_writeoff_id: writeOffId,
      });
      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error || "Operation failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-writeoffs"] });
      toast.success("Write-off approved successfully");
      setIsApproveDialogOpen(false);
      setSelectedWriteOff(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve write-off");
    },
  });

  // Reject write-off mutation - atomic RPC
  const rejectWriteOffMutation = useMutation({
    mutationFn: async ({ writeOffId, reason }: { writeOffId: string; reason: string }) => {
      if (!canManageWriteOffs) throw new Error("Permission denied: write-offs manage");
      const { data, error } = await supabase.rpc("admin_reject_loan_writeoff", {
        p_writeoff_id: writeOffId,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error || "Operation failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-writeoffs"] });
      toast.success("Write-off rejected");
      setIsRejectDialogOpen(false);
      setRejectReason("");
      setSelectedWriteOff(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject write-off");
    },
  });

  // Record recovery mutation - atomic RPC
  const recordRecoveryMutation = useMutation({
    mutationFn: async ({ writeOffId, amount, notes }: { writeOffId: string; amount: number; notes: string }) => {
      if (!canManageWriteOffs) throw new Error("Permission denied: write-offs manage");
      const { data, error } = await supabase.rpc("admin_record_writeoff_recovery", {
        p_writeoff_id: writeOffId,
        p_amount: amount,
        p_notes: notes,
      });
      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error || "Operation failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-writeoffs"] });
      toast.success("Recovery recorded successfully");
      setIsRecoveryDialogOpen(false);
      setRecoveryAmount("");
      setRecoveryNotes("");
      setSelectedWriteOff(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record recovery");
    },
  });

  // Filter write-offs
  const filteredWriteOffs = writeOffs?.filter(wo => {
    const matchesSearch = 
      wo.loan?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.loan?.phone?.includes(searchQuery);
    
    if (activeTab === "pending") return matchesSearch && wo.status === "pending";
    if (activeTab === "approved") return matchesSearch && wo.status === "approved";
    if (activeTab === "rejected") return matchesSearch && wo.status === "rejected";
    return matchesSearch;
  });

  // Stats
  const pendingCount = writeOffs?.filter(w => w.status === "pending").length || 0;
  const approvedCount = writeOffs?.filter(w => w.status === "approved").length || 0;
  const totalWrittenOff = writeOffs?.filter(w => w.status === "approved")
    .reduce((sum, w) => sum + Number(w.writeoff_amount), 0) || 0;
  const totalRecovered = writeOffs?.filter(w => w.status === "approved")
    .reduce((sum, w) => sum + Number(w.recovery_amount || 0), 0) || 0;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      approved: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: FileX },
      rejected: { color: "bg-muted text-muted-foreground border-muted", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Write-Off Management</h1>
          <p className="text-muted-foreground mt-1">Review and manage loan write-off requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Approval</p>
                <p className="text-xl font-bold text-foreground">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center text-destructive">
                <FileX size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Written Off</p>
                <p className="text-xl font-bold text-foreground">{approvedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <TrendingDown size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Write-Off Value</p>
                <p className="text-xl font-bold text-foreground">K{totalWrittenOff.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center text-success">
                <RefreshCw size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recovered</p>
                <p className="text-xl font-bold text-foreground">K{totalRecovered.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by borrower name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              <Clock size={14} className="mr-2" />
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="approved">
              <FileX size={14} className="mr-2" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <XCircle size={14} className="mr-2" />
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                  </div>
                ) : filteredWriteOffs && filteredWriteOffs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Loan Amount</TableHead>
                          <TableHead>Write-Off Amount</TableHead>
                          <TableHead>Recovered</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWriteOffs.map((wo) => (
                          <TableRow key={wo.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{wo.loan?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{wo.loan?.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell>K{Number(wo.loan?.loan_amount || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-destructive font-semibold">
                              K{Number(wo.writeoff_amount).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-success">
                              K{Number(wo.recovery_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{wo.reason}</TableCell>
                            <TableCell>{format(new Date(wo.created_at), "MMM dd, yyyy")}</TableCell>
                            <TableCell>{getStatusBadge(wo.status || "pending")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/admin/loans?loan=${wo.loan_id}`)}
                                >
                                  <Eye size={14} />
                                </Button>
                                {wo.status === "pending" && canManageWriteOffs && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-success border-success/30 hover:bg-success/10"
                                      onClick={() => {
                                        setSelectedWriteOff(wo);
                                        setIsApproveDialogOpen(true);
                                      }}
                                    >
                                      <CheckCircle size={14} className="mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                      onClick={() => {
                                        setSelectedWriteOff(wo);
                                        setIsRejectDialogOpen(true);
                                      }}
                                    >
                                      <XCircle size={14} className="mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {wo.status === "approved" && canManageWriteOffs && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedWriteOff(wo);
                                      setIsRecoveryDialogOpen(true);
                                    }}
                                  >
                                    <Banknote size={14} className="mr-1" />
                                    Recovery
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileX className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                    <h3 className="text-lg font-medium">No write-offs found</h3>
                    <p className="text-muted-foreground">
                      {activeTab === "pending" ? "No pending write-off requests" : "No records match your search"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Approve Write-Off
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to approve a write-off of <strong className="text-destructive">K{Number(selectedWriteOff?.writeoff_amount || 0).toLocaleString()}</strong> for {selectedWriteOff?.loan?.full_name}.</p>
              <p>This will mark the loan as <strong>defaulted</strong> and affect portfolio at risk metrics.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => approveWriteOffMutation.mutate(selectedWriteOff?.id)}
              disabled={approveWriteOffMutation.isPending}
            >
              {approveWriteOffMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Approve Write-Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle size={20} />
              Reject Write-Off
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this write-off request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Explain why this write-off is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectWriteOffMutation.mutate({ writeOffId: selectedWriteOff?.id, reason: rejectReason })}
              disabled={rejectWriteOffMutation.isPending || !rejectReason}
            >
              {rejectWriteOffMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Reject Write-Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery Dialog */}
      <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote size={20} />
              Record Recovery
            </DialogTitle>
            <DialogDescription>
              Record any amount recovered from this written-off loan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                <span className="text-muted-foreground">Written Off:</span>{" "}
                <strong>K{Number(selectedWriteOff?.writeoff_amount || 0).toLocaleString()}</strong>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Already Recovered:</span>{" "}
                <strong className="text-success">K{Number(selectedWriteOff?.recovery_amount || 0).toLocaleString()}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Recovery Amount (K)</Label>
              <Input
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                placeholder="How was this amount recovered?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecoveryDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => recordRecoveryMutation.mutate({
                writeOffId: selectedWriteOff?.id,
                amount: Number(recoveryAmount),
                notes: recoveryNotes,
              })}
              disabled={recordRecoveryMutation.isPending || !recoveryAmount || Number(recoveryAmount) <= 0}
            >
              {recordRecoveryMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Record Recovery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWriteOffs;
