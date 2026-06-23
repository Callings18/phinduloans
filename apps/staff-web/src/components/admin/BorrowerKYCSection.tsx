import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { getSignedUrl } from "@phinduloans/shared/utils/storageHelpers";
import {
  CheckCircle, XCircle, Clock, FileText, Eye, Download, ShieldCheck, AlertTriangle, Upload,
} from "lucide-react";
import { differenceInHours } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@phinduloans/shared/components/ui/dialog";
import PersonalInfoForm from "./kyc/PersonalInfoForm";
import EmploymentIncomeForm from "./kyc/EmploymentIncomeForm";
import FinancialInfoForm from "./kyc/FinancialInfoForm";
import ReferencesForm from "./kyc/ReferencesForm";

interface BorrowerKYCSectionProps {
  borrowerId: string;
}

const KYC_DOC_TYPES = [
  { type: "nrc_front", label: "NRC (Front)" },
  { type: "nrc_back", label: "NRC (Back)" },
  { type: "selfie", label: "Selfie Holding NRC" },
];

export default function BorrowerKYCSection({ borrowerId }: BorrowerKYCSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectDocLabel, setRejectDocLabel] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [expandedHistoryType, setExpandedHistoryType] = useState<string | null>(null);

  useEffect(() => {
    if (!borrowerId) return;
    const channel = supabase
      .channel(`admin-borrower-kyc-${borrowerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrower_document_vault", filter: `borrower_id=eq.${borrowerId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrower_kyc_info", filter: `borrower_id=eq.${borrowerId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", borrowerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [borrowerId, queryClient]);

  // Upload KYC document on behalf of borrower
  const handleUploadKYC = async (file: File, docType: string, docLabel: string) => {
    setUploadingType(docType);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `kyc/${borrowerId}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("borrower_document_vault")
        .insert({
          borrower_id: borrowerId,
          doc_type: docType,
          doc_label: docLabel,
          file_url: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          is_verified: false,
          verified_at: null,
          verified_by: null,
          notes: null,
        });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
      toast({ title: `${docLabel} uploaded successfully` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingType(null);
    }
  };

  // Document vault
  const { data: vaultDocs = [], isLoading } = useQuery({
    queryKey: ["borrower-kyc-vault", borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("*")
        .eq("borrower_id", borrowerId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!borrowerId,
  });

  // Profile (employment & income)
  const { data: profile } = useQuery({
    queryKey: ["borrower-profile-kyc", borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, nrc_number, address, city, employer_name, job_title, employment_type, years_in_employment, net_income")
        .eq("id", borrowerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!borrowerId,
  });

  // KYC info (financial, next of kin)
  const { data: kycInfo } = useQuery({
    queryKey: ["borrower-kyc-info", borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_kyc_info")
        .select("*")
        .eq("borrower_id", borrowerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!borrowerId,
  });

  // References
  const { data: references = [] } = useQuery({
    queryKey: ["borrower-references", borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_references")
        .select("*")
        .eq("borrower_id", borrowerId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!borrowerId,
  });

  const approveMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({ is_verified: true, verified_by: adminId, verified_at: new Date().toISOString(), notes: null })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
      toast({ title: "Document approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveAllMutation = useMutation({
    mutationFn: async (docIds: string[]) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({ is_verified: true, verified_by: adminId, verified_at: new Date().toISOString(), notes: null })
        .in("id", docIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
      toast({ title: "All documents approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ docId, reason, docLabel }: { docId: string; reason: string; docLabel: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({ is_verified: false, verified_by: adminId, verified_at: new Date().toISOString(), notes: `Rejected: ${reason}` })
        .eq("id", docId);
      if (error) throw error;

      try {
        const { data: profileData } = await supabase.from("profiles").select("phone, full_name").eq("id", borrowerId).maybeSingle();
        if (profileData) {
          const name = profileData.full_name || "Customer";
          if (profileData.phone) {
            await supabase.from("notification_logs").insert({
              user_id: borrowerId, type: "sms", recipient: profileData.phone, title: "KYC Document Rejected",
              message: `Dear ${name}, your document "${docLabel}" was rejected: ${reason}. Please re-upload. — Phindu Finance`,
              status: "pending",
            });
          }
        }
      } catch (notifErr) {
        console.error("Failed to send rejection notification:", notifErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      toast({ title: "Document rejected", description: "Borrower has been notified to re-upload." });
      setRejectDocId(null);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePreview = async (fileUrl: string) => {
    const url = fileUrl.startsWith("http") ? fileUrl : await getSignedUrl(fileUrl);
    if (url) setPreviewUrl(url);
    else toast({ title: "Permission denied", description: "Contact an admin for access.", variant: "destructive" });
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const url = fileUrl.startsWith("http") ? fileUrl : await getSignedUrl(fileUrl);
      if (!url) {
        toast({ title: "Could not generate download link", variant: "destructive" });
        return;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    }
  };

  const docsByType: Record<string, typeof vaultDocs[0]> = {};
  vaultDocs.forEach((d) => { if (!docsByType[d.doc_type]) docsByType[d.doc_type] = d; });

  const allDocsVerified = KYC_DOC_TYPES.every(t => docsByType[t.type]?.is_verified === true);
  const anyUploaded = KYC_DOC_TYPES.some(t => !!docsByType[t.type]);

  return (
    <>
      {/* Personal Information (editable) */}
      <PersonalInfoForm borrowerId={borrowerId} profile={profile} />

      {/* Identity Documents */}
      <Card className={`border-border/50 ${allDocsVerified ? "bg-emerald-500/5 border-emerald-500/30" : anyUploaded ? "bg-yellow-500/5 border-yellow-500/30" : "bg-muted/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className={allDocsVerified ? "text-emerald-400" : "text-muted-foreground"} size={18} />
            <h4 className="font-semibold text-foreground">KYC / Identity Documents</h4>
            {allDocsVerified ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border ml-auto">✅ Fully Verified</Badge>
            ) : (() => {
              const pendingDocs = KYC_DOC_TYPES
                .map(t => docsByType[t.type])
                .filter(d => d && !d.is_verified && !(d.verified_at && d.notes?.startsWith("Rejected:")));
              return pendingDocs.length > 1 ? (
                <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => approveAllMutation.mutate(pendingDocs.map(d => d.id))} disabled={approveAllMutation.isPending}>
                  <CheckCircle size={12} className="mr-1" /> Approve All ({pendingDocs.length})
                </Button>
              ) : null;
            })()}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {KYC_DOC_TYPES.map((kycType) => {
                const doc = docsByType[kycType.type];
                const versions = vaultDocs.filter((d) => d.doc_type === kycType.type);
                const isRejected = doc && !doc.is_verified && doc.verified_at && doc.notes?.startsWith("Rejected:");
                const pendingHours = doc?.uploaded_at ? differenceInHours(new Date(), new Date(doc.uploaded_at)) : 0;
                const pendingState = pendingHours >= 72 ? "urgent" : pendingHours >= 48 ? "waiting" : "normal";
                return (
                  <div key={kycType.type} className="flex flex-col gap-2 p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{kycType.label}</p>
                        {doc ? (
                          <p className="text-xs text-muted-foreground">{doc.file_name} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not uploaded</p>
                        )}
                        {versions.length > 1 && (
                          <button
                            type="button"
                            className="text-[11px] text-primary mt-0.5 hover:underline"
                            onClick={() => setExpandedHistoryType(expandedHistoryType === kycType.type ? null : kycType.type)}
                          >
                            {expandedHistoryType === kycType.type ? "Hide" : "View"} history ({versions.length})
                          </button>
                        )}
                        {isRejected && <p className="text-xs text-destructive mt-0.5">{doc.notes?.replace("Rejected: ", "")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {!doc ? (
                        <>
                          <Badge variant="outline" className="text-muted-foreground gap-1"><AlertTriangle size={12} /> Missing</Badge>
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadKYC(file, kycType.type, kycType.label); e.target.value = ""; }} disabled={uploadingType === kycType.type} />
                            <span className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background hover:bg-accent cursor-pointer">
                              <Upload size={12} /> {uploadingType === kycType.type ? "Uploading..." : "Upload"}
                            </span>
                          </label>
                        </>
                      ) : doc.is_verified ? (
                        <>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle size={12} /> Verified</Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)} title="View"><Eye size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.file_url, doc.file_name)} title="Download"><Download size={14} /></Button>
                        </>
                      ) : isRejected ? (
                        <>
                          <Badge variant="destructive" className="gap-1"><XCircle size={12} /> Rejected</Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)} title="View"><Eye size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.file_url, doc.file_name)} title="Download"><Download size={14} /></Button>
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadKYC(file, kycType.type, kycType.label); e.target.value = ""; }} disabled={uploadingType === kycType.type} />
                            <span className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background hover:bg-accent cursor-pointer">
                              <Upload size={12} /> Re-upload
                            </span>
                          </label>
                        </>
                      ) : (
                        <>
                          <Badge
                            className={
                              pendingState === "urgent"
                                ? "bg-destructive/20 text-destructive border-destructive/30 border gap-1"
                                : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1"
                            }
                          >
                            <Clock size={12} />
                            {pendingState === "urgent" ? `Urgent (${pendingHours}h)` : pendingState === "waiting" ? `Waiting (${pendingHours}h)` : "Pending"}
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)} title="View"><Eye size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.file_url, doc.file_name)} title="Download"><Download size={14} /></Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => approveMutation.mutate(doc.id)} disabled={approveMutation.isPending}>Approve</Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => { setRejectDocId(doc.id); setRejectDocLabel(kycType.label); }}>Reject</Button>
                        </>
                      )}
                    </div>
                    </div>
                    {expandedHistoryType === kycType.type && versions.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-border/40 w-full">
                        <div className="space-y-1.5">
                          {versions.slice(1).map((version) => (
                            <div
                              key={version.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5"
                            >
                              <span className="text-[11px] text-muted-foreground truncate">
                                {version.file_name} • {new Date(version.uploaded_at).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handlePreview(version.file_url)} title="View">
                                  <Eye size={12} />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handleDownload(version.file_url, version.file_name)} title="Download">
                                  <Download size={12} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employment & Income (editable) */}
      <EmploymentIncomeForm borrowerId={borrowerId} profile={profile} />

      {/* Financial Information & Next of Kin (editable) */}
      <FinancialInfoForm borrowerId={borrowerId} kycInfo={kycInfo} />

      {/* Personal References (add/verify/delete) */}
      <ReferencesForm borrowerId={borrowerId} references={references} />

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Document Preview</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.includes(".pdf") ? (
              <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" />
            ) : (
              <img src={previewUrl} alt="Document" className="w-full max-h-[70vh] object-contain rounded-lg" />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDocId} onOpenChange={() => { setRejectDocId(null); setRejectDocLabel(""); setRejectReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Reject Document{rejectDocLabel ? `: ${rejectDocLabel}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">The borrower will be notified via SMS.</p>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectDocId(null); setRejectDocLabel(""); setRejectReason(""); }}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                if (!rejectReason.trim()) { toast({ title: "Please provide a reason", variant: "destructive" }); return; }
                if (rejectDocId) rejectMutation.mutate({ docId: rejectDocId, reason: rejectReason, docLabel: rejectDocLabel });
              }} disabled={rejectMutation.isPending}>Reject Document</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
