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
  CheckCircle, XCircle, Clock, FileText, Eye, ShieldCheck, AlertTriangle,
  Banknote, Users, UserCheck, Smartphone, Phone,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BorrowerKYCSectionProps {
  borrowerId: string;
}

const KYC_DOC_TYPES = [
  { type: "nrc_front", label: "NRC (Front)" },
  { type: "nrc_back", label: "NRC (Back)" },
  { type: "selfie", label: "Selfie Holding NRC" },
  { type: "proof_of_residence", label: "Proof of Residence" },
];

export default function BorrowerKYCSection({ borrowerId }: BorrowerKYCSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_document_vault")
        .update({ is_verified: false, verified_by: adminId, verified_at: new Date().toISOString(), notes: `Rejected: ${reason}` })
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

  const verifyKycInfoMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_kyc_info")
        .update({ is_verified: true, verified_by: adminId, verified_at: new Date().toISOString() })
        .eq("borrower_id", borrowerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", borrowerId] });
      toast({ title: "Financial info verified" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyReferenceMutation = useMutation({
    mutationFn: async (refId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_references")
        .update({ is_verified: true, verified_by: adminId, verified_at: new Date().toISOString() })
        .eq("id", refId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", borrowerId] });
      toast({ title: "Reference verified" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePreview = async (fileUrl: string) => {
    const url = fileUrl.startsWith("http") ? fileUrl : await getSignedUrl(fileUrl);
    if (url) setPreviewUrl(url);
    else toast({ 
      title: "Permission denied", 
      description: "You do not have permission to view this document. Please contact an admin to grant you access.", 
      variant: "destructive" 
    });
  };

  // Map vault docs by type
  const docsByType: Record<string, typeof vaultDocs[0]> = {};
  vaultDocs.forEach((d) => { if (!docsByType[d.doc_type]) docsByType[d.doc_type] = d; });

  const allDocsVerified = KYC_DOC_TYPES.every(t => docsByType[t.type]?.is_verified === true);
  const anyUploaded = KYC_DOC_TYPES.some(t => !!docsByType[t.type]);

  return (
    <>
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
                <Button
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  onClick={() => approveAllMutation.mutate(pendingDocs.map(d => d.id))}
                  disabled={approveAllMutation.isPending}
                >
                  <CheckCircle size={12} className="mr-1" />
                  Approve All ({pendingDocs.length})
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
                const isRejected = doc && !doc.is_verified && doc.verified_at && doc.notes?.startsWith("Rejected:");
                return (
                  <div key={kycType.type} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{kycType.label}</p>
                        {doc ? (
                          <p className="text-xs text-muted-foreground">{doc.file_name} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not uploaded</p>
                        )}
                        {isRejected && <p className="text-xs text-destructive mt-0.5">{doc.notes?.replace("Rejected: ", "")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!doc ? (
                        <Badge variant="outline" className="text-muted-foreground gap-1"><AlertTriangle size={12} /> Missing</Badge>
                      ) : doc.is_verified ? (
                        <>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle size={12} /> Verified</Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}><Eye size={14} /></Button>
                        </>
                      ) : isRejected ? (
                        <>
                          <Badge variant="destructive" className="gap-1"><XCircle size={12} /> Rejected</Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}><Eye size={14} /></Button>
                        </>
                      ) : (
                        <>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1"><Clock size={12} /> Pending</Badge>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.file_url)}><Eye size={14} /></Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => approveMutation.mutate(doc.id)} disabled={approveMutation.isPending}>Approve</Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => setRejectDocId(doc.id)}>Reject</Button>
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

      {/* Financial Information */}
      {kycInfo && (
        <Card className={`border-border/50 ${kycInfo.is_verified ? "bg-emerald-500/5 border-emerald-500/30" : "bg-yellow-500/5 border-yellow-500/30"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className={kycInfo.is_verified ? "text-emerald-400" : "text-muted-foreground"} size={18} />
              <h4 className="font-semibold text-foreground">Financial Information</h4>
              {kycInfo.is_verified ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border ml-auto gap-1"><CheckCircle size={12} /> Verified</Badge>
              ) : (
                <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => verifyKycInfoMutation.mutate()} disabled={verifyKycInfoMutation.isPending}>
                  Verify Financial Info
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Mobile Money */}
              {(kycInfo.airtel_money_number || kycInfo.mtn_mobile_money_number || kycInfo.zamtel_kwacha_number) && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Smartphone size={12} /> Mobile Money</p>
                  {kycInfo.airtel_money_number && <p className="text-sm text-foreground">Airtel: {kycInfo.airtel_money_number}</p>}
                  {kycInfo.mtn_mobile_money_number && <p className="text-sm text-foreground">MTN: {kycInfo.mtn_mobile_money_number}</p>}
                  {kycInfo.zamtel_kwacha_number && <p className="text-sm text-foreground">Zamtel: {kycInfo.zamtel_kwacha_number}</p>}
                  {kycInfo.mobile_money_account_name && <p className="text-xs text-muted-foreground mt-1">Name: {kycInfo.mobile_money_account_name}</p>}
                </div>
              )}
              {/* Bank Account */}
              {kycInfo.bank_name && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Banknote size={12} /> Bank Account</p>
                  <p className="text-sm text-foreground">{kycInfo.bank_name} — {kycInfo.bank_account_number}</p>
                  <p className="text-xs text-muted-foreground">Holder: {kycInfo.bank_account_holder_name}</p>
                  {kycInfo.bank_branch && <p className="text-xs text-muted-foreground">Branch: {kycInfo.bank_branch}</p>}
                  <p className="text-xs text-muted-foreground">Type: {kycInfo.account_type}</p>
                </div>
              )}
              {/* Next of Kin */}
              {kycInfo.nok_full_name && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/30 md:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Users size={12} /> Next of Kin</p>
                  <p className="text-sm text-foreground">{kycInfo.nok_full_name} ({kycInfo.nok_relationship})</p>
                  <p className="text-xs text-muted-foreground">Phone: {kycInfo.nok_phone}{kycInfo.nok_alt_phone ? ` / ${kycInfo.nok_alt_phone}` : ""}</p>
                  {kycInfo.nok_nrc_number && <p className="text-xs text-muted-foreground">NRC: {kycInfo.nok_nrc_number}</p>}
                  {kycInfo.nok_address && <p className="text-xs text-muted-foreground">Address: {kycInfo.nok_address}</p>}
                  {kycInfo.nok_district && <p className="text-xs text-muted-foreground">District: {kycInfo.nok_district}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal References */}
      {references.length > 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="text-muted-foreground" size={18} />
              <h4 className="font-semibold text-foreground">Personal References ({references.length})</h4>
            </div>
            <div className="space-y-2">
              {references.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{ref.full_name} ({ref.relationship})</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} /> {ref.phone}{ref.alt_phone ? ` / ${ref.alt_phone}` : ""}</p>
                    {ref.occupation && <p className="text-xs text-muted-foreground">{ref.occupation}</p>}
                    {ref.years_known && <p className="text-xs text-muted-foreground">Known {ref.years_known} years</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {ref.is_verified ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle size={12} /> Verified</Badge>
                    ) : (
                      <Button size="sm" className="h-7 text-xs" onClick={() => verifyReferenceMutation.mutate(ref.id)} disabled={verifyReferenceMutation.isPending}>
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
      <Dialog open={!!rejectDocId} onOpenChange={() => { setRejectDocId(null); setRejectReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Reject Document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectDocId(null); setRejectReason(""); }}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                if (!rejectReason.trim()) { toast({ title: "Please provide a reason", variant: "destructive" }); return; }
                if (rejectDocId) rejectMutation.mutate({ docId: rejectDocId, reason: rejectReason });
              }} disabled={rejectMutation.isPending}>Reject Document</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
