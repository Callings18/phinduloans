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
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Loader2,
  Eye,
  Upload,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentChecklistItem {
  id: string;
  loan_id: string;
  document_type: string;
  document_name: string;
  is_required: boolean;
  is_submitted: boolean;
  is_verified: boolean;
  verified_at: string | null;
  rejection_reason: string | null;
  file_url: string | null;
  notes: string | null;
}

interface Props {
  loanId: string;
}

const DEFAULT_DOCUMENTS = [
  { type: "nrc_front", name: "NRC Front", required: true },
  { type: "nrc_back", name: "NRC Back", required: true },
  { type: "payslip", name: "Latest Payslip", required: true },
  { type: "bank_statement", name: "3 Months Bank Statements", required: true },
  { type: "employer_letter", name: "Employment Confirmation Letter", required: false },
  { type: "utility_bill", name: "Utility Bill (Proof of Address)", required: false },
  { type: "selfie", name: "Selfie with NRC", required: true },
  { type: "contract", name: "Signed Loan Contract", required: true },
];

export default function DocumentVerificationTab({ loanId }: Props) {
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentChecklistItem | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"verified" | "rejected">("verified");
  const [rejectionReason, setRejectionReason] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [newDocType, setNewDocType] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocRequired, setNewDocRequired] = useState(true);

  const queryClient = useQueryClient();

  // Fetch document checklist
  const { data: documents, isLoading } = useQuery({
    queryKey: ["document-checklist", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_checklists")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as DocumentChecklistItem[];
    },
  });

  // Initialize checklist mutation
  const initChecklistMutation = useMutation({
    mutationFn: async () => {
      const checklistItems = DEFAULT_DOCUMENTS.map((doc) => ({
        loan_id: loanId,
        document_type: doc.type,
        document_name: doc.name,
        is_required: doc.required,
      }));

      const { error } = await supabase.from("document_checklists").insert(checklistItems);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", loanId] });
      toast.success("Document checklist initialized");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to initialize checklist");
    },
  });

  // Add document mutation
  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("document_checklists").insert({
        loan_id: loanId,
        document_type: newDocType,
        document_name: newDocName,
        is_required: newDocRequired,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", loanId] });
      toast.success("Document added to checklist");
      setIsAddDocOpen(false);
      setNewDocType("");
      setNewDocName("");
      setNewDocRequired(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add document");
    },
  });

  // Update checklist document submission status mutation
  const updateDocStatusMutation = useMutation({
    mutationFn: async ({ docId, isSubmitted }: { docId: string; isSubmitted: boolean }) => {
      const { error } = await supabase
        .from("document_checklists")
        .update({ is_submitted: isSubmitted })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", loanId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update document status");
    },
  });

  // Verify checklist document mutation
  const verifyDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoc) throw new Error("No document selected");
      const user = (await supabase.auth.getUser()).data.user;

      const updateData: Record<string, any> = {
        is_verified: verificationStatus === "verified",
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
        notes: verificationNotes || null,
      };

      if (verificationStatus === "rejected") {
        updateData.rejection_reason = rejectionReason;
        updateData.is_submitted = false; // Reset submission for re-upload
      } else {
        updateData.rejection_reason = null;
      }

      const { error } = await supabase
        .from("document_checklists")
        .update(updateData)
        .eq("id", selectedDoc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", loanId] });
      toast.success(
        verificationStatus === "verified" ? "Document verified" : "Document rejected"
      );
      setIsVerifyOpen(false);
      setSelectedDoc(null);
      setVerificationStatus("verified");
      setRejectionReason("");
      setVerificationNotes("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify document");
    },
  });

  // Calculate stats
  const totalRequired = documents?.filter((d) => d.is_required).length || 0;
  const submittedCount = documents?.filter((d) => d.is_submitted).length || 0;
  const verifiedCount = documents?.filter((d) => d.is_verified).length || 0;
  const rejectedCount = documents?.filter((d) => d.rejection_reason).length || 0;
  const pendingVerification = documents?.filter((d) => d.is_submitted && !d.is_verified && !d.rejection_reason).length || 0;

  const getDocStatusBadge = (doc: DocumentChecklistItem) => {
    if (doc.is_verified) {
      return (
        <Badge className="bg-success/20 text-success border-success/30">
          <CheckCircle size={12} className="mr-1" /> Verified
        </Badge>
      );
    }
    if (doc.rejection_reason) {
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
          <XCircle size={12} className="mr-1" /> Rejected
        </Badge>
      );
    }
    if (doc.is_submitted) {
      return (
        <Badge className="bg-info/20 text-info border-info/30">
          <Clock size={12} className="mr-1" /> Pending Verification
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/20 text-warning border-warning/30">
        <AlertTriangle size={12} className="mr-1" /> Not Submitted
      </Badge>
    );
  };

  // Helper to get signed URL for viewing documents
  const getSignedUrl = async (filePath: string | null): Promise<string | null> => {
    if (!filePath) return null;
    
    // If it's already a full URL, return as-is (legacy data)
    if (filePath.startsWith('http')) return filePath;
    
    const { data, error } = await supabase.storage
      .from('loan-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  const handleViewDocument = async (fileUrl: string | null) => {
    const signedUrl = await getSignedUrl(fileUrl);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    } else {
      toast.error('Unable to view document');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">No Document Checklist</h3>
          <p className="text-muted-foreground mb-4">
            Initialize the document checklist for this loan
          </p>
          <Button onClick={() => initChecklistMutation.mutate()} disabled={initChecklistMutation.isPending}>
            {initChecklistMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
            <Plus size={14} className="mr-1" /> Initialize Checklist
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Documents</p>
            <p className="text-lg font-bold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-lg font-bold">{submittedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Verified</p>
            <p className="text-lg font-bold text-success">{verifiedCount}</p>
          </CardContent>
        </Card>
        <Card className={pendingVerification > 0 ? "bg-info/10 border-info/20" : "bg-muted/30"}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className={`text-lg font-bold ${pendingVerification > 0 ? "text-info" : ""}`}>
              {pendingVerification}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-base">Document Checklist</CardTitle>
              <CardDescription>Verify borrower documents before approval</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsAddDocOpen(true)}>
              <Plus size={14} className="mr-1" /> Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CheckCircle size={14} /> Checklist Verification
            </h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Submitted</span>
                    </TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className={doc.rejection_reason ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={doc.is_submitted}
                          onCheckedChange={(checked) =>
                            updateDocStatusMutation.mutate({
                              docId: doc.id,
                              isSubmitted: checked as boolean,
                            })
                          }
                          disabled={doc.is_verified}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                          {doc.rejection_reason && (
                            <p className="text-xs text-destructive mt-1">
                              Rejection: {doc.rejection_reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.is_required ? (
                          <Badge variant="outline">Required</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>{getDocStatusBadge(doc)}</TableCell>
                      <TableCell>
                        {doc.verified_at ? (
                          <span className="text-xs">
                            {format(new Date(doc.verified_at), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {doc.file_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(doc.file_url)}
                            >
                              <Eye size={14} />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDoc(doc);
                              setIsVerifyOpen(true);
                            }}
                            disabled={!doc.is_submitted}
                          >
                            Verify
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document to Checklist</DialogTitle>
            <DialogDescription>
              Add a new document requirement to this loan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Input
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                placeholder="e.g., proof_of_income"
              />
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="e.g., Proof of Income"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={newDocRequired}
                onCheckedChange={(checked) => setNewDocRequired(checked as boolean)}
              />
              <Label>Required Document</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDocOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addDocumentMutation.mutate()}
              disabled={!newDocType || !newDocName || addDocumentMutation.isPending}
            >
              {addDocumentMutation.isPending && (
                <Loader2 className="animate-spin mr-2" size={14} />
              )}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Document Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Document</DialogTitle>
            <DialogDescription>
              Review and verify: {selectedDoc?.document_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Status</Label>
              <Select
                value={verificationStatus}
                onValueChange={(v) => setVerificationStatus(v as "verified" | "rejected")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-success" />
                      Verified
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <XCircle size={14} className="text-destructive" />
                      Rejected
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {verificationStatus === "rejected" && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this document was rejected..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => verifyDocumentMutation.mutate()}
              disabled={
                (verificationStatus === "rejected" && !rejectionReason) ||
                verifyDocumentMutation.isPending
              }
            >
              {verifyDocumentMutation.isPending && (
                <Loader2 className="animate-spin mr-2" size={14} />
              )}
              {verificationStatus === "verified" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
