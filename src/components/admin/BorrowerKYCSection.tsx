import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/utils/storageHelpers";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BorrowerKYCSectionProps {
  borrowerId: string;
}

const KYC_DOC_TYPES = [
  { type: "nrc_front", label: "NRC (Front)" },
  { type: "nrc_back", label: "NRC (Back)" },
  { type: "selfie", label: "Selfie / Passport Photo" },
  { type: "proof_of_residence", label: "Proof of Residence" },
];

export default function BorrowerKYCSection({ borrowerId }: BorrowerKYCSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  const approveMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({
          is_verified: true,
          verified_by: adminId,
          verified_at: new Date().toISOString(),
          notes: null,
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      toast({ title: "Document approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({
          is_verified: false,
          verified_by: adminId,
          verified_at: new Date().toISOString(),
          notes: `Rejected: ${reason}`,
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", borrowerId] });
      toast({ title: "Document rejected" });
      setRejectDocId(null);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePreview = async (fileUrl: string) => {
    const url = fileUrl.startsWith("http") ? fileUrl : await getSignedUrl(fileUrl);
    if (url) setPreviewUrl(url);
    else toast({ title: "Could not load document", variant: "destructive" });
  };

  // Map vault docs by type
  const docsByType: Record<string, typeof vaultDocs[0]> = {};
  vaultDocs.forEach((d) => {
    // Keep the most recent for each type
    if (!docsByType[d.doc_type]) docsByType[d.doc_type] = d;
  });

  const allVerified = KYC_DOC_TYPES.every(
    (t) => docsByType[t.type]?.is_verified === true
  );
  const anyUploaded = KYC_DOC_TYPES.some((t) => !!docsByType[t.type]);

  return (
    <>
      <Card className={`border-border/50 ${allVerified ? "bg-emerald-500/5 border-emerald-500/30" : anyUploaded ? "bg-yellow-500/5 border-yellow-500/30" : "bg-muted/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className={allVerified ? "text-emerald-400" : "text-muted-foreground"} size={18} />
            <h4 className="font-semibold text-foreground">KYC / Identity Documents</h4>
            {allVerified && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border ml-auto">
                ✅ Fully Verified
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {KYC_DOC_TYPES.map((kycType) => {
                const doc = docsByType[kycType.type];
                const isRejected = doc && !doc.is_verified && doc.verified_at && doc.notes?.startsWith("Rejected:");

                return (
                  <div
                    key={kycType.type}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{kycType.label}</p>
                        {doc ? (
                          <p className="text-xs text-muted-foreground">
                            {doc.file_name} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not uploaded</p>
                        )}
                        {isRejected && (
                          <p className="text-xs text-destructive mt-0.5">
                            {doc.notes?.replace("Rejected: ", "")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!doc ? (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <AlertTriangle size={12} />
                          Missing
                        </Badge>
                      ) : doc.is_verified ? (
                        <>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
                            <CheckCircle size={12} />
                            Verified
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}>
                            <Eye size={14} />
                          </Button>
                        </>
                      ) : isRejected ? (
                        <>
                          <Badge variant="destructive" className="gap-1">
                            <XCircle size={12} />
                            Rejected
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}>
                            <Eye size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1">
                            <Clock size={12} />
                            Pending
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}>
                            <Eye size={14} />
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => approveMutation.mutate(doc.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive border-destructive/30"
                            onClick={() => setRejectDocId(doc.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
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

      {/* Reject Dialog */}
      <Dialog open={!!rejectDocId} onOpenChange={() => { setRejectDocId(null); setRejectReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reject Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (e.g., blurry image, expired document)..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectDocId(null); setRejectReason(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast({ title: "Please provide a reason", variant: "destructive" });
                    return;
                  }
                  if (rejectDocId) rejectMutation.mutate({ docId: rejectDocId, reason: rejectReason });
                }}
                disabled={rejectMutation.isPending}
              >
                Reject Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
