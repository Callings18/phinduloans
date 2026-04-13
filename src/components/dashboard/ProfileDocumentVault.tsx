import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/utils/storageHelpers";
import {
  FileText, Upload, Eye, CheckCircle, Clock, XCircle, Camera, ShieldCheck, AlertTriangle, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BORROWER_VAULT_KYC_DOC_TYPES, borrowerVaultCoreSlotsUploaded } from "@/constants/borrowerKycDocs";

const KYC_DOC_TYPES = [...BORROWER_VAULT_KYC_DOC_TYPES];

interface Props {
  userId: string;
}

export default function ProfileDocumentVault({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [expandedHistoryType, setExpandedHistoryType] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: vaultDocs = [], isLoading } = useQuery({
    queryKey: ["borrower-kyc-vault", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("*")
        .eq("borrower_id", userId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`borrower-kyc-vault-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrower_document_vault", filter: `borrower_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", userId] });
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, docType, label }: { file: File; docType: string; label: string }) => {
      setUploadingType(docType);
      const ext = file.name.split(".").pop() || "bin";
      const path = `kyc/${userId}/${docType}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("borrower_document_vault").insert({
        borrower_id: userId,
        doc_type: docType,
        doc_label: label,
        file_url: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", userId] });
      toast({ title: "Document uploaded successfully" });
      setUploadingType(null);

      // Check if all KYC docs are now uploaded → notify admin
      try {
        const { data: allDocs } = await supabase
          .from("borrower_document_vault")
          .select("doc_type")
          .eq("borrower_id", userId);
        const uploadedTypes = new Set(allDocs?.map((d) => d.doc_type) || []);
        const allUploaded = borrowerVaultCoreSlotsUploaded(uploadedTypes);
        if (allUploaded) {
          // Get borrower name for the notification
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();
          const name = profile?.full_name || "A borrower";
          // Send notification via edge function (fire-and-forget)
          supabase.functions.invoke("send-notification", {
            body: {
              type: "email",
              to: "", // Edge function will use admin email from settings
              subject: "KYC Documents Submitted - Pending Verification",
              message: `${name} has completed uploading all KYC documents (NRC Front, NRC Back, Selfie Holding NRC, Proof of Residence). Please log in to verify their documents.`,
              title: "KYC Submission Complete",
              eventType: "kyc_completed",
              notifyAdmins: true,
            },
          }).catch((err) => {
            if (import.meta.env.DEV) console.warn("[ProfileDocumentVault] KYC email notify failed:", err);
          });
          supabase.functions.invoke("send-notification", {
            body: {
              type: "sms",
              to: "",
              message: `${name} has completed KYC document uploads. Please log in to verify. - Phindu Finance`,
              title: "KYC Submission Complete",
              eventType: "kyc_completed",
              notifyAdmins: true,
            },
          }).catch((err) => {
            if (import.meta.env.DEV) console.warn("[ProfileDocumentVault] KYC SMS notify failed:", err);
          });
        }
      } catch {
        // Non-critical, don't block UI
      }
    },
    onError: (e: any) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      setUploadingType(null);
    },
  });

  const handlePreview = async (fileUrl: string) => {
    const url = fileUrl.startsWith("http") ? fileUrl : await getSignedUrl(fileUrl);
    if (url) setPreviewUrl(url);
    else toast({ title: "Could not load document", variant: "destructive" });
  };

  const handleFileSelect = (docType: string, label: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({ file, docType, label });
  };

  // Map by type (most recent)
  const docsByType: Record<string, typeof vaultDocs[0]> = {};
  vaultDocs.forEach((d) => {
    if (!docsByType[d.doc_type]) docsByType[d.doc_type] = d;
  });

  const verifiedCount = KYC_DOC_TYPES.filter((t) => docsByType[t.type]?.is_verified).length;
  const allVerified = verifiedCount === KYC_DOC_TYPES.length;

  return (
    <>
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className={allVerified ? "text-emerald-400" : "text-muted-foreground"} size={20} />
                Identity Documents (KYC)
              </CardTitle>
              <CardDescription>
                Upload your identity documents once — they'll be reused for all future applications
              </CardDescription>
            </div>
            {allVerified && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border">
                ✅ Fully Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {KYC_DOC_TYPES.map((kycType) => {
                const doc = docsByType[kycType.type];
                const versions = vaultDocs.filter((d) => d.doc_type === kycType.type);
                const isRejected = doc && !doc.is_verified && doc.verified_at && doc.notes?.startsWith("Rejected:");
                const isUploading = uploadingType === kycType.type;

                return (
                  <div
                    key={kycType.type}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <FileText className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{kycType.label}</p>
                        {doc ? (
                          <p className="text-xs text-muted-foreground">
                            {doc.file_name} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not uploaded yet</p>
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
                        {isRejected && (
                          <p className="text-xs text-destructive mt-0.5">
                            <AlertTriangle size={10} className="inline mr-1" />
                            {doc.notes?.replace("Rejected: ", "")} — Please re-upload
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {!doc || isRejected ? (
                        <>
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            {isRejected ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            {isRejected ? "Rejected" : "Missing"}
                          </Badge>
                          <input
                            type="file"
                            ref={(el) => { fileRefs.current[kycType.type] = el; }}
                            className="hidden"
                            accept={kycType.accept}
                            capture={kycType.capture ? "environment" : undefined}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(kycType.type, kycType.label, file);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileRefs.current[kycType.type]?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <Loader2 size={14} className="mr-1 animate-spin" />
                            ) : kycType.capture ? (
                              <Camera size={14} className="mr-1" />
                            ) : (
                              <Upload size={14} className="mr-1" />
                            )}
                            Upload
                          </Button>
                        </>
                      ) : doc.is_verified ? (
                        <>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
                            <CheckCircle size={12} /> Verified
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}>
                            <Eye size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1">
                            <Clock size={12} /> Pending Review
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}>
                            <Eye size={14} />
                          </Button>
                        </>
                      )}
                    </div>

                    {expandedHistoryType === kycType.type && versions.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
                        {versions.slice(1).map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5"
                          >
                            <span className="text-[11px] text-muted-foreground truncate">
                              {version.file_name} • {new Date(version.uploaded_at).toLocaleString()}
                            </span>
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handlePreview(version.file_url)}>
                              <Eye size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.includes(".pdf") ? (
              <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" />
            ) : (
              <img src={previewUrl} alt="Document" className="w-full max-h-[70vh] object-contain rounded-lg" />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
