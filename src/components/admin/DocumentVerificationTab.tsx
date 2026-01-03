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
  const [verifyingDynamicDoc, setVerifyingDynamicDoc] = useState<any>(null);

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

  // Fetch dynamic application documents
  const { data: applicationDocs } = useQuery({
    queryKey: ["application-documents", loanId],
    queryFn: async () => {
      // @ts-expect-error - Table exists after migrations
      const { data, error } = await supabase
        .from("loan_application_documents")
        .select("*")
        .eq("application_id", loanId);

      if (error) throw error;
      return data;
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

  // Verify dynamic application document mutation
  const verifyDynamicDocMutation = useMutation({
    mutationFn: async () => {
      if (!verifyingDynamicDoc) throw new Error("No document selected");

      const updateData: Record<string, any> = {
        status: verificationStatus,
        // @ts-expect-error - Column exists after migrations
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        // @ts-expect-error - Column exists after migrations
        reviewed_at: new Date().toISOString(),
        // @ts-expect-error - Column exists after migrations
        rejection_reason: verificationStatus === "rejected" ? rejectionReason : null,
      };

      const { error } = await supabase
        .from("loan_application_documents")
        .update(updateData)
        .eq("id", verifyingDynamicDoc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-documents", loanId] });
      toast.success(`Document ${verificationStatus}ed successfully`);
      setIsVerifyOpen(false);
      setVerifyingDynamicDoc(null);
      setVerificationStatus("verified");
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update document status");
    }
  });

  // Calculate stats
  const totalRequired = documents?.filter((d) => d.is_required).length || 0;
  const submittedCount = documents?.filter((d) => d.is_submitted).length || 0;
  const verifiedCount = documents?.filter((d) => d.is_verified).length || 0;
  const rejectedCount = documents?.filter((d) => d.rejection_reason).length || 0;
  const pendingChecklistReview = documents?.filter((d) => d.is_submitted && !d.is_verified && !d.rejection_reason).length || 0;
  const pendingDynamicReview = applicationDocs?.filter((d: any) => d.status === 'pending').length || 0;
  const pendingVerification = pendingChecklistReview + pendingDynamicReview;

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
          {/* Dynamic Application Documents Section */}
          {applicationDocs && applicationDocs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Upload size={14} /> Submitted Application Documents
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {applicationDocs.map((doc: any) => (
                  <div key={doc.id} className={`flex items-center justify-between p-3 rounded-lg border ${doc.status === 'rejected' ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-secondary/10'}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium uppercase text-xs flex items-center gap-1">
                        {doc.document_type.replace(/_/g, ' ')}
                        {doc.status === 'verified' && <ShieldCheck size={12} className="text-success" />}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">{doc.file_name}</span>
                      {doc.rejection_reason && (
                        <span className="text-[10px] text-red-500 font-medium italic">Reason: {doc.rejection_reason}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 px-2 text-xs ${doc.status === 'pending' ? 'border-primary/50 text-primary' : ''}`}
                        onClick={() => {
                          setVerifyingDynamicDoc(doc);
                          setIsVerifyOpen(true);
                        }}
                      >
                        {doc.status === 'pending' ? 'Review' : 'Update'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                          <span className="text-muted-foreground text-sm">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>{getDocStatusBadge(doc)}</TableCell>
                      <TableCell>
                        {doc.verified_at
                          ? format(new Date(doc.verified_at), "MMM dd, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {doc.file_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(doc.file_url!, "_blank")}
                            >
                              <Eye size={14} />
                            </Button>
                          )}
                          {doc.is_submitted && !doc.is_verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDoc(doc);
                                setIsVerifyOpen(true);
                              }}
                            >
                              Verify
                            </Button>
                          )}
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
            <DialogDescription>Add a custom document requirement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Input
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                placeholder="e.g., collateral_photo"
              />
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="e.g., Collateral Photo"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="required"
                checked={newDocRequired}
                onCheckedChange={(checked) => setNewDocRequired(checked as boolean)}
              />
              <Label htmlFor="required">Required Document</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDocOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addDocumentMutation.mutate()}
              disabled={addDocumentMutation.isPending || !newDocType || !newDocName}
            >
              {addDocumentMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerifyOpen} onOpenChange={(open) => {
        setIsVerifyOpen(open);
        if (!open) {
          setSelectedDoc(null);
          setVerifyingDynamicDoc(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Document</DialogTitle>
            <DialogDescription>
              Review and verify {selectedDoc?.document_name || verifyingDynamicDoc?.document_type?.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Verification Decision</Label>
              <Select
                value={verificationStatus}
                onValueChange={(v: "verified" | "rejected") => setVerificationStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">
                    <span className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-success" /> Approve
                    </span>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <span className="flex items-center gap-2">
                      <XCircle size={14} className="text-destructive" /> Reject
                    </span>
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
                  placeholder="Explain why this document is being rejected..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Additional notes about this document..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsVerifyOpen(false);
              setSelectedDoc(null);
              setVerifyingDynamicDoc(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (verifyingDynamicDoc) {
                  verifyDynamicDocMutation.mutate();
                } else {
                  verifyDocumentMutation.mutate();
                }
              }}
              disabled={
                (verifyingDynamicDoc ? verifyDynamicDocMutation.isPending : verifyDocumentMutation.isPending) ||
                (verificationStatus === "rejected" && !rejectionReason)
              }
              className={verificationStatus === "rejected" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {(verifyingDynamicDoc ? verifyDynamicDocMutation.isPending : verifyDocumentMutation.isPending) &&
                <Loader2 className="animate-spin mr-2" size={14} />
              }
              {verificationStatus === "verified" ? (
                <>
                  <CheckCircle size={14} className="mr-1" /> Approve
                </>
              ) : (
                <>
                  <XCircle size={14} className="mr-1" /> Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
