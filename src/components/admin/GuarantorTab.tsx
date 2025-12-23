import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  UserPlus,
  Shield,
  Edit,
  Trash2,
} from "lucide-react";
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

interface Guarantor {
  id: string;
  loan_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
  employment_status: string | null;
  employer_name: string | null;
  monthly_income: number | null;
  is_verified: boolean;
  verified_at: string | null;
  verification_notes: string | null;
  consent_signed: boolean;
  consent_date: string | null;
  created_at: string;
}

interface Props {
  loanId: string;
}

const RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Relative",
  "Friend",
  "Colleague",
  "Business Partner",
  "Other",
];

const EMPLOYMENT_STATUS_OPTIONS = [
  "Employed",
  "Self-Employed",
  "Business Owner",
  "Retired",
  "Unemployed",
];

export default function GuarantorTab({ loanId }: Props) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGuarantor, setSelectedGuarantor] = useState<Guarantor | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  
  const [formData, setFormData] = useState({
    full_name: "",
    relationship: "",
    phone: "",
    email: "",
    nrc_number: "",
    address: "",
    city: "",
    employment_status: "",
    employer_name: "",
    monthly_income: "",
    consent_signed: false,
  });

  const queryClient = useQueryClient();

  // Fetch guarantors
  const { data: guarantors, isLoading } = useQuery({
    queryKey: ["loan-guarantors", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_guarantors")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Guarantor[];
    },
  });

  // Add guarantor mutation
  const addGuarantorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_guarantors").insert({
        loan_id: loanId,
        full_name: formData.full_name,
        relationship: formData.relationship,
        phone: formData.phone,
        email: formData.email || null,
        nrc_number: formData.nrc_number || null,
        address: formData.address || null,
        city: formData.city || null,
        employment_status: formData.employment_status || null,
        employer_name: formData.employer_name || null,
        monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
        consent_signed: formData.consent_signed,
        consent_date: formData.consent_signed ? new Date().toISOString().split("T")[0] : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-guarantors", loanId] });
      toast.success("Guarantor added successfully");
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add guarantor");
    },
  });

  // Update guarantor mutation
  const updateGuarantorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGuarantor) throw new Error("No guarantor selected");
      const { error } = await supabase
        .from("loan_guarantors")
        .update({
          full_name: formData.full_name,
          relationship: formData.relationship,
          phone: formData.phone,
          email: formData.email || null,
          nrc_number: formData.nrc_number || null,
          address: formData.address || null,
          city: formData.city || null,
          employment_status: formData.employment_status || null,
          employer_name: formData.employer_name || null,
          monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
          consent_signed: formData.consent_signed,
          consent_date: formData.consent_signed && !selectedGuarantor.consent_date 
            ? new Date().toISOString().split("T")[0] 
            : selectedGuarantor.consent_date,
        })
        .eq("id", selectedGuarantor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-guarantors", loanId] });
      toast.success("Guarantor updated successfully");
      setIsEditOpen(false);
      setSelectedGuarantor(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update guarantor");
    },
  });

  // Verify guarantor mutation
  const verifyGuarantorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGuarantor) throw new Error("No guarantor selected");
      const user = (await supabase.auth.getUser()).data.user;
      
      const { error } = await supabase
        .from("loan_guarantors")
        .update({
          is_verified: true,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: verificationNotes || null,
        })
        .eq("id", selectedGuarantor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-guarantors", loanId] });
      toast.success("Guarantor verified successfully");
      setIsVerifyOpen(false);
      setSelectedGuarantor(null);
      setVerificationNotes("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify guarantor");
    },
  });

  // Delete guarantor mutation
  const deleteGuarantorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGuarantor) throw new Error("No guarantor selected");
      const { error } = await supabase
        .from("loan_guarantors")
        .delete()
        .eq("id", selectedGuarantor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-guarantors", loanId] });
      toast.success("Guarantor removed");
      setIsDeleteOpen(false);
      setSelectedGuarantor(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove guarantor");
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      relationship: "",
      phone: "",
      email: "",
      nrc_number: "",
      address: "",
      city: "",
      employment_status: "",
      employer_name: "",
      monthly_income: "",
      consent_signed: false,
    });
  };

  const openEdit = (guarantor: Guarantor) => {
    setSelectedGuarantor(guarantor);
    setFormData({
      full_name: guarantor.full_name,
      relationship: guarantor.relationship,
      phone: guarantor.phone,
      email: guarantor.email || "",
      nrc_number: guarantor.nrc_number || "",
      address: guarantor.address || "",
      city: guarantor.city || "",
      employment_status: guarantor.employment_status || "",
      employer_name: guarantor.employer_name || "",
      monthly_income: guarantor.monthly_income?.toString() || "",
      consent_signed: guarantor.consent_signed,
    });
    setIsEditOpen(true);
  };

  const verifiedCount = guarantors?.filter((g) => g.is_verified).length || 0;
  const consentCount = guarantors?.filter((g) => g.consent_signed).length || 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const GuarantorForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <Input
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Guarantor's full name"
          />
        </div>
        <div className="space-y-2">
          <Label>Relationship *</Label>
          <Select
            value={formData.relationship}
            onValueChange={(v) => setFormData({ ...formData, relationship: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map((rel) => (
                <SelectItem key={rel} value={rel.toLowerCase()}>
                  {rel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+260 9XX XXX XXX"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="guarantor@email.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>NRC Number</Label>
          <Input
            value={formData.nrc_number}
            onChange={(e) => setFormData({ ...formData, nrc_number: e.target.value })}
            placeholder="XXX/XXX/XXX"
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Full address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Employment Status</Label>
          <Select
            value={formData.employment_status}
            onValueChange={(v) => setFormData({ ...formData, employment_status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status.toLowerCase().replace(" ", "_")}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Employer Name</Label>
          <Input
            value={formData.employer_name}
            onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
            placeholder="Employer name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Monthly Income</Label>
        <Input
          type="number"
          value={formData.monthly_income}
          onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
          placeholder="Monthly income in ZMW"
        />
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
        <Checkbox
          id="consent"
          checked={formData.consent_signed}
          onCheckedChange={(checked) => setFormData({ ...formData, consent_signed: checked as boolean })}
        />
        <Label htmlFor="consent" className="text-sm">
          Guarantor has signed the consent form and agrees to the terms
        </Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      {guarantors && guarantors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Guarantors</p>
              <p className="text-lg font-bold">{guarantors.length}</p>
            </CardContent>
          </Card>
          <Card className={verifiedCount > 0 ? "bg-success/10 border-success/20" : "bg-muted/30"}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Verified</p>
              <p className={`text-lg font-bold ${verifiedCount > 0 ? "text-success" : ""}`}>
                {verifiedCount}
              </p>
            </CardContent>
          </Card>
          <Card className={consentCount > 0 ? "bg-info/10 border-info/20" : "bg-muted/30"}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Consented</p>
              <p className={`text-lg font-bold ${consentCount > 0 ? "text-info" : ""}`}>
                {consentCount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guarantors Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield size={18} /> Loan Guarantors
              </CardTitle>
              <CardDescription>Manage guarantors for this loan</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus size={14} className="mr-1" /> Add Guarantor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {guarantors && guarantors.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guarantors.map((guarantor) => (
                    <TableRow key={guarantor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-muted-foreground" />
                          <div>
                            <p className="font-medium">{guarantor.full_name}</p>
                            {guarantor.nrc_number && (
                              <p className="text-xs text-muted-foreground">NRC: {guarantor.nrc_number}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{guarantor.relationship}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            <Phone size={12} className="text-muted-foreground" />
                            {guarantor.phone}
                          </div>
                          {guarantor.email && (
                            <div className="flex items-center gap-1">
                              <Mail size={12} className="text-muted-foreground" />
                              {guarantor.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {guarantor.employment_status ? (
                          <div>
                            <p className="capitalize">{guarantor.employment_status.replace("_", " ")}</p>
                            {guarantor.employer_name && (
                              <p className="text-xs text-muted-foreground">{guarantor.employer_name}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {guarantor.is_verified ? (
                            <Badge className="bg-success/20 text-success border-success/30 w-fit">
                              <CheckCircle size={12} className="mr-1" /> Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-warning/20 text-warning border-warning/30 w-fit">
                              Pending
                            </Badge>
                          )}
                          {guarantor.consent_signed && (
                            <Badge variant="outline" className="w-fit text-xs">
                              Consented
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!guarantor.is_verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedGuarantor(guarantor);
                                setIsVerifyOpen(true);
                              }}
                            >
                              <CheckCircle size={14} className="mr-1" /> Verify
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(guarantor)}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedGuarantor(guarantor);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No Guarantors</h3>
              <p className="text-muted-foreground mb-4">Add guarantors to secure this loan</p>
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus size={14} className="mr-1" /> Add Guarantor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Guarantor Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={20} /> Add Guarantor
            </DialogTitle>
            <DialogDescription>Add a new guarantor for this loan</DialogDescription>
          </DialogHeader>
          <GuarantorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => addGuarantorMutation.mutate()}
              disabled={addGuarantorMutation.isPending || !formData.full_name || !formData.relationship || !formData.phone}
            >
              {addGuarantorMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Add Guarantor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Guarantor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit size={20} /> Edit Guarantor
            </DialogTitle>
            <DialogDescription>Update guarantor information</DialogDescription>
          </DialogHeader>
          <GuarantorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedGuarantor(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => updateGuarantorMutation.mutate()}
              disabled={updateGuarantorMutation.isPending || !formData.full_name || !formData.relationship || !formData.phone}
            >
              {updateGuarantorMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Guarantor Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={20} className="text-success" /> Verify Guarantor
            </DialogTitle>
            <DialogDescription>
              Confirm verification of {selectedGuarantor?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="font-medium">{selectedGuarantor?.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedGuarantor?.phone} • {selectedGuarantor?.relationship}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Verification Notes (Optional)</Label>
              <Textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Notes about the verification process..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => verifyGuarantorMutation.mutate()}
              disabled={verifyGuarantorMutation.isPending}
            >
              {verifyGuarantorMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              <CheckCircle size={14} className="mr-1" /> Verify Guarantor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Guarantor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedGuarantor?.full_name} as a guarantor? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGuarantorMutation.mutate()}
            >
              {deleteGuarantorMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
