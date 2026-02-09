import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  User,
  Phone,
  Calendar,
  CreditCard,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Mail,
  MapPin,
  IdCard,
  Ban,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import GuidedTour from "@/components/common/GuidedTour";
import { Step } from "react-joyride";
import { HelpCircle } from "lucide-react";

interface BorrowerForm {
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address: string;
  city: string;
}

interface BlacklistData {
  reason: string;
  duration: string; // "permanent" | number of days as string
}

const emptyForm: BorrowerForm = {
  full_name: "",
  email: "",
  phone: "",
  nrc_number: "",
  address: "",
  city: "Lusaka",
};

const zambianCities = [
  "Lusaka", "Kitwe", "Ndola", "Kabwe", "Chingola", "Mufulira", "Luanshya",
  "Livingstone", "Kasama", "Chipata", "Chinsali", "Mansa", "Solwezi",
  "Mongu", "Mazabuka", "Monze", "Kalomo", "Choma", "Kafue",
  "Chililabombwe", "Kapiri Mposhi", "Nakonde", "Mbala", "Mpika", "Petauke"
].sort();

const AdminBorrowers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [formData, setFormData] = useState<BorrowerForm>(emptyForm);
  const [blacklistData, setBlacklistData] = useState<BlacklistData>({ reason: "", duration: "permanent" });
  const [runTour, setRunTour] = useState(false);

  const tourSteps: Step[] = [
    {
      target: ".tour-borrowers-header",
      content: "This is your borrower database. You can manage all registered clients from here.",
      placement: "bottom",
    },
    {
      target: ".tour-borrowers-search",
      content: "Instantly find a borrower by their name, email, or NRC number.",
      placement: "bottom",
    },
    {
      target: ".tour-borrowers-list",
      content: "View detailed profiles, contact info, and manage accounts for each borrower.",
      placement: "top",
    },
    {
      target: ".tour-borrowers-add",
      content: "Manually register a new borrower if they are applying in-person at your office.",
      placement: "left",
    }
  ];

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: borrowers, isLoading } = useQuery({
    queryKey: ['admin-borrowers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: loanCounts } = useQuery({
    queryKey: ['borrower-loan-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_applications')
        .select('user_id');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach(loan => {
        counts[loan.user_id] = (counts[loan.user_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: borrowerLoans } = useQuery({
    queryKey: ['borrower-loans', selectedBorrower?.id],
    queryFn: async () => {
      if (!selectedBorrower?.id) return [];
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*')
        .eq('user_id', selectedBorrower.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedBorrower?.id && isViewOpen,
  });

  // Create borrower mutation - Uses edge function to create auth user
  const createMutation = useMutation({
    mutationFn: async (data: BorrowerForm) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke('create-borrower', {
        body: {
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || null,
          nrc_number: data.nrc_number || null,
          address: data.address || null,
          city: data.city || null,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-borrowers'] });
      toast({ title: "Borrower created successfully" });
      setIsAddOpen(false);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: "Error creating borrower", description: error.message, variant: "destructive" });
    },
  });

  // Update borrower mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BorrowerForm> }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          nrc_number: data.nrc_number || null,
          address: data.address || null,
          city: data.city || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-borrowers'] });
      toast({ title: "Borrower updated successfully" });
      setIsEditOpen(false);
      setSelectedBorrower(null);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: "Error updating borrower", description: error.message, variant: "destructive" });
    },
  });

  // Delete borrower mutation with safety checks
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if borrower has active loans
      const { data: activeLoans, error: loansError } = await supabase
        .from('loan_applications')
        .select('id, status')
        .eq('user_id', id)
        .in('status', ['active', 'disbursed', 'approved', 'completed']);
      
      if (loansError) throw loansError;
      
      if (activeLoans && activeLoans.length > 0) {
        throw new Error(`Cannot delete borrower. This borrower has ${activeLoans.length} active or completed loan(s).`);
      }
      
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-borrowers'] });
      toast({ title: "Borrower deleted successfully" });
      setIsDeleteOpen(false);
      setIsViewOpen(false);
      setSelectedBorrower(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting borrower", description: error.message, variant: "destructive" });
    },
  });

  // Blacklist mutation
  const blacklistMutation = useMutation({
    mutationFn: async ({ id, blacklist, reason, duration }: { id: string; blacklist: boolean; reason?: string; duration?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      let blacklistExpiresAt: string | null = null;
      if (blacklist && duration && duration !== "permanent") {
        const days = parseInt(duration);
        if (!isNaN(days) && days > 0) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);
          blacklistExpiresAt = expiryDate.toISOString();
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          is_blacklisted: blacklist,
          blacklist_reason: blacklist ? reason : null,
          blacklisted_at: blacklist ? new Date().toISOString() : null,
          blacklisted_by: blacklist ? userId : null,
          blacklist_expires_at: blacklist ? blacklistExpiresAt : null,
        } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-borrowers'] });
      toast({
        title: variables.blacklist ? "Borrower blacklisted" : "Borrower removed from blacklist",
        description: variables.blacklist
          ? "This borrower will no longer qualify for new loans"
          : "This borrower can now apply for loans again"
      });
      setIsBlacklistOpen(false);
      setBlacklistData({ reason: "", duration: "permanent" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating blacklist status", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!formData.full_name?.trim() || !formData.email?.trim()) {
      toast({ title: "Please fill in required fields (Name and Email)", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedBorrower || !formData.full_name?.trim()) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedBorrower.id, data: formData });
  };

  const openEditDialog = (borrower: any) => {
    setSelectedBorrower(borrower);
    setFormData({
      full_name: borrower.full_name || "",
      email: borrower.email || "",
      phone: borrower.phone || "",
      nrc_number: borrower.nrc_number || "",
      address: borrower.address || "",
      city: borrower.city || "",
    });
    setIsEditOpen(true);
  };

  const openViewDialog = (borrower: any) => {
    setSelectedBorrower(borrower);
    setIsViewOpen(true);
  };

  const filteredBorrowers = borrowers?.filter(borrower =>
    borrower.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.nrc_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.nrc_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    defaulted: { label: "Defaulted", color: "bg-red-600/20 text-red-500 border-red-600/30" },
  };

  return (
    <AdminLayout>
      <GuidedTour
        steps={tourSteps}
        tourKey="admin-borrowers"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tour-borrowers-header">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Borrowers</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground mt-1">Manage your borrower profiles</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                onClick={() => setRunTour(true)}
              >
                <HelpCircle size={14} className="mr-1" />
                Tour
              </Button>
            </div>
          </div>
          <Button onClick={() => { setFormData(emptyForm); setIsAddOpen(true); }} className="gap-2 tour-borrowers-add">
            <Plus size={16} />
            Add Borrower
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{borrowers?.length || 0}</p>
              <p className="text-muted-foreground text-sm">Total Borrowers</p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {borrowers?.filter(b => (loanCounts?.[b.id] || 0) > 0).length || 0}
              </p>
              <p className="text-muted-foreground text-sm">With Loans</p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {borrowers?.filter(b => b.nrc_number).length || 0}
              </p>
              <p className="text-muted-foreground text-sm">Verified (NRC)</p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {borrowers?.filter(b => {
                  const created = new Date(b.created_at);
                  const now = new Date();
                  return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                }).length || 0}
              </p>
              <p className="text-muted-foreground text-sm">This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass border-border/50 tour-borrowers-search">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name, email, phone, or NRC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Borrowers Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBorrowers && filteredBorrowers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 tour-borrowers-list">
            {filteredBorrowers.map((borrower) => (
              <Card key={borrower.id} className={`glass border-border/50 hover:border-primary/30 transition-colors ${borrower.is_blacklisted ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${borrower.is_blacklisted ? 'bg-destructive/20' : 'gradient-primary'} flex items-center justify-center`}>
                      {borrower.is_blacklisted ? (
                        <Ban className="text-destructive" size={24} />
                      ) : (
                        <User className="text-primary-foreground" size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground truncate">
                          {borrower.full_name || 'Unknown'}
                        </h4>
                        {borrower.is_blacklisted && (
                          <Badge variant="destructive" className="text-xs">Blacklisted</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm truncate">{borrower.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    {borrower.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} />
                        <span>{borrower.phone}</span>
                      </div>
                    )}
                    {borrower.nrc_number && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IdCard size={14} />
                        <span>{borrower.nrc_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} />
                      <span>Joined {new Date(borrower.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard size={14} />
                      <span>{loanCounts?.[borrower.id] || 0} loan(s)</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openViewDialog(borrower)}
                    >
                      <Eye size={14} className="mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(borrower)}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="p-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No borrowers found</p>
              <Button onClick={() => { setFormData(emptyForm); setIsAddOpen(true); }}>
                <Plus size={16} className="mr-2" />
                Add First Borrower
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Borrower Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add New Borrower</DialogTitle>
            <DialogDescription>Create a new borrower profile</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+260 967 713 001"
              />
            </div>
            <div className="space-y-2">
              <Label>NRC Number</Label>
              <Input
                value={formData.nrc_number}
                onChange={(e) => setFormData({ ...formData, nrc_number: e.target.value })}
                placeholder="123456/78/1"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={formData.city}
                onValueChange={(value) => setFormData({ ...formData, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {zambianCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus size={16} className="mr-1" />
              Add Borrower
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Borrower Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Borrower</DialogTitle>
            <DialogDescription>Update borrower profile details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                disabled
                className="opacity-50"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+260 967 713 001"
              />
            </div>
            <div className="space-y-2">
              <Label>NRC Number</Label>
              <Input
                value={formData.nrc_number}
                onChange={(e) => setFormData({ ...formData, nrc_number: e.target.value })}
                placeholder="123456/78/1"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={formData.city}
                onValueChange={(value) => setFormData({ ...formData, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {zambianCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Borrower Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <User className="text-primary-foreground" size={20} />
              </div>
              {selectedBorrower?.full_name || 'Borrower Details'}
            </DialogTitle>
            <DialogDescription>{selectedBorrower?.email}</DialogDescription>
          </DialogHeader>

          {selectedBorrower && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="text-foreground font-medium">{selectedBorrower.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="text-foreground font-medium">{selectedBorrower.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="text-foreground font-medium">{selectedBorrower.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NRC Number</p>
                    <p className="text-foreground font-medium">{selectedBorrower.nrc_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="text-foreground font-medium">{selectedBorrower.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p className="text-foreground font-medium">{selectedBorrower.address || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="text-foreground font-medium">
                      {new Date(selectedBorrower.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Loan History */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Loan History ({borrowerLoans?.length || 0})</h4>
                {borrowerLoans && borrowerLoans.length > 0 ? (
                  <div className="space-y-3">
                    {borrowerLoans.map((loan: any) => {
                      const config = statusConfig[loan.status] || statusConfig.pending;
                      return (
                        <Card key={loan.id} className="bg-secondary/30 border-border/50">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">
                                  K{Number(loan.loan_amount).toLocaleString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {loan.loan_term_months} {(loan as any).term_unit || 'months'} • {loan.loan_purpose}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Applied: {new Date(loan.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge className={`${config.color} border`}>
                                {config.label}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No loan applications yet</p>
                )}
              </div>

              {/* Blacklist Section */}
              <Card className={selectedBorrower.is_blacklisted ? "bg-warning/10 border-warning/30" : "bg-muted/30 border-border/50"}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedBorrower.is_blacklisted ? (
                      <AlertTriangle className="text-warning" size={18} />
                    ) : (
                      <Ban className="text-muted-foreground" size={18} />
                    )}
                    <h4 className="font-semibold text-foreground">Blacklist Status</h4>
                  </div>
                  {selectedBorrower.is_blacklisted ? (
                    <div className="space-y-2">
                      <p className="text-sm text-warning">
                        This borrower is currently blacklisted and cannot apply for new loans.
                      </p>
                      {selectedBorrower.blacklist_reason && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Reason:</strong> {selectedBorrower.blacklist_reason}
                        </p>
                      )}
                      {selectedBorrower.blacklisted_at && (
                        <p className="text-xs text-muted-foreground">
                          Blacklisted on: {new Date(selectedBorrower.blacklisted_at).toLocaleDateString()}
                        </p>
                      )}
                      {(selectedBorrower as any).blacklist_expires_at && (
                        <p className="text-xs text-warning font-medium">
                          Expires: {new Date((selectedBorrower as any).blacklist_expires_at).toLocaleDateString()}
                        </p>
                      )}
                      {!(selectedBorrower as any).blacklist_expires_at && selectedBorrower.is_blacklisted && (
                        <p className="text-xs text-destructive font-medium">Duration: Permanent</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => blacklistMutation.mutate({ id: selectedBorrower.id, blacklist: false })}
                        disabled={blacklistMutation.isPending}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Remove from Blacklist
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        This borrower is in good standing. You can blacklist them to prevent future loan applications.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setBlacklistData({ reason: "", duration: "permanent" });
                          setIsBlacklistOpen(true);
                        }}
                      >
                        <Ban size={14} className="mr-1" />
                        Add to Blacklist
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-destructive mb-2">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Permanently delete this borrower profile. This cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete Borrower
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => openEditDialog(selectedBorrower)}>
              <Pencil size={16} className="mr-1" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Borrower</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedBorrower?.full_name}</span>?
              This action cannot be undone and may affect related loan records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedBorrower && deleteMutation.mutate(selectedBorrower.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blacklist Dialog */}
      <Dialog open={isBlacklistOpen} onOpenChange={setIsBlacklistOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Ban size={20} />
              Blacklist Borrower
            </DialogTitle>
            <DialogDescription>
              Add <span className="font-semibold">{selectedBorrower?.full_name}</span> to the blacklist.
              They will no longer be able to apply for loans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Blacklisting *</Label>
              <Textarea
                value={blacklistData.reason}
                onChange={(e) => setBlacklistData({ ...blacklistData, reason: e.target.value })}
                placeholder="Enter the reason for blacklisting this borrower (e.g., fraud, non-payment, etc.)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={blacklistData.duration}
                onValueChange={(value) => setBlacklistData({ ...blacklistData, duration: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                  <SelectItem value="180">6 Months</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {blacklistData.duration === "permanent" 
                  ? "This borrower will be permanently blacklisted until manually removed."
                  : `Blacklist will automatically expire after ${blacklistData.duration} days.`
                }
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBlacklistOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!blacklistData.reason.trim()) {
                  toast({ title: "Please provide a reason for blacklisting", variant: "destructive" });
                  return;
                }
                blacklistMutation.mutate({
                  id: selectedBorrower.id,
                  blacklist: true,
                  reason: blacklistData.reason,
                  duration: blacklistData.duration,
                });
              }}
              disabled={blacklistMutation.isPending}
            >
              <Ban size={14} className="mr-1" />
              Confirm Blacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBorrowers;
