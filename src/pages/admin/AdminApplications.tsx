import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  CreditCard,
  Briefcase,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  under_review: { label: "Under Review", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  defaulted: { label: "Defaulted", color: "bg-red-600/20 text-red-500 border-red-600/30" },
};

const AdminApplications = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: applications, isLoading } = useQuery({
    queryKey: ['admin-applications', statusFilter],
    queryFn: async () => {
      let query = supabase.from('loan_applications').select('*').order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as "pending" | "under_review" | "approved" | "rejected" | "disbursed" | "active" | "completed" | "defaulted");
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updateData: any = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      
      if (reason) {
        updateData.rejection_reason = reason;
      }

      const { error } = await supabase
        .from('loan_applications')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      toast({ title: "Application updated successfully" });
      setIsViewOpen(false);
      setRejectionReason("");
    },
    onError: (error) => {
      toast({ title: "Error updating application", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = async () => {
    if (!selectedApp) return;
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ id: selectedApp.id, status: 'approved' });
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason) {
      toast({ title: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ 
      id: selectedApp.id, 
      status: 'rejected',
      reason: rejectionReason,
    });
    setIsProcessing(false);
  };

  const filteredApps = applications?.filter(app =>
    app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.nrc_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Loan Applications</h1>
            <p className="text-muted-foreground mt-1">Review and manage loan applications</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name, email, or NRC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter size={16} className="mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredApps && filteredApps.length > 0 ? (
          <div className="space-y-4">
            {filteredApps.map((app) => {
              const config = statusConfig[app.status as keyof typeof statusConfig];
              
              return (
                <Card key={app.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                          <User className="text-primary" size={24} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-foreground">{app.full_name}</h4>
                          <p className="text-muted-foreground text-sm">{app.email}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CreditCard size={12} />
                              K{Number(app.loan_amount).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase size={12} />
                              {app.employer_name || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={`${config?.color} border`}>
                          {config?.label}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye size={16} className="mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Application Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Application Details</DialogTitle>
            <DialogDescription>Review the loan application details below</DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6">
              {/* Applicant Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <User size={18} />
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="text-foreground font-medium">{selectedApp.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="text-foreground font-medium">{selectedApp.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="text-foreground font-medium">{selectedApp.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NRC Number</p>
                    <p className="text-foreground font-medium">{selectedApp.nrc_number}</p>
                  </div>
                </div>
              </div>

              {/* Employment Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Briefcase size={18} />
                  Employment Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Employer</p>
                    <p className="text-foreground font-medium">{selectedApp.employer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Job Title</p>
                    <p className="text-foreground font-medium">{selectedApp.job_title || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Income</p>
                    <p className="text-foreground font-medium">K{Number(selectedApp.monthly_income).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employment Type</p>
                    <p className="text-foreground font-medium capitalize">{selectedApp.employment_type}</p>
                  </div>
                </div>
              </div>

              {/* Loan Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <CreditCard size={18} />
                  Loan Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Loan Amount</p>
                    <p className="text-foreground font-medium text-lg">K{Number(selectedApp.loan_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Term</p>
                    <p className="text-foreground font-medium">{selectedApp.loan_term_months} months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purpose</p>
                    <p className="text-foreground font-medium capitalize">{selectedApp.loan_purpose}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Payment</p>
                    <p className="text-foreground font-medium">K{Number(selectedApp.monthly_payment || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Rejection Reason Input (for pending applications) */}
              {selectedApp.status === 'pending' && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Rejection Reason (required if rejecting)</label>
                  <Textarea
                    placeholder="Enter reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {selectedApp?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  <XCircle size={16} className="mr-1" />
                  Reject
                </Button>
                <Button
                  variant="hero"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  <CheckCircle size={16} className="mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminApplications;
