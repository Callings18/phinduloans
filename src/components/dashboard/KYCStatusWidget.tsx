import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck, Clock, AlertTriangle, CheckCircle, XCircle, Upload } from "lucide-react";

const KYC_DOC_TYPES = [
  { type: "nrc_front", label: "NRC (Front)" },
  { type: "nrc_back", label: "NRC (Back)" },
  { type: "selfie", label: "Selfie Holding NRC" },
  { type: "proof_of_residence", label: "Proof of Residence" },
];

interface KYCStatusWidgetProps {
  userId: string;
}

export default function KYCStatusWidget({ userId }: KYCStatusWidgetProps) {
  const { data: vaultDocs = [] } = useQuery({
    queryKey: ["borrower-kyc-vault", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("doc_type, is_verified, verified_at, notes")
        .eq("borrower_id", userId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Map by type (most recent)
  const docsByType: Record<string, typeof vaultDocs[0]> = {};
  vaultDocs.forEach((d) => {
    if (!docsByType[d.doc_type]) docsByType[d.doc_type] = d;
  });

  const verifiedCount = KYC_DOC_TYPES.filter((t) => docsByType[t.type]?.is_verified).length;
  const allVerified = verifiedCount === KYC_DOC_TYPES.length;
  const uploadedCount = KYC_DOC_TYPES.filter((t) => !!docsByType[t.type]).length;

  if (allVerified) {
    return (
      <Card className="glass border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="text-emerald-400" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Identity Verified ✅</p>
            <p className="text-xs text-muted-foreground">Your KYC documents have been approved. You won't need to re-upload them.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-yellow-500/30 bg-yellow-500/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="text-yellow-400" size={16} />
          KYC Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          {KYC_DOC_TYPES.map((t) => {
            const doc = docsByType[t.type];
            const isRejected = doc && !doc.is_verified && doc.verified_at && doc.notes?.startsWith("Rejected:");

            return (
              <div key={t.type} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.label}</span>
                {!doc ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Upload size={10} /> Not Uploaded
                  </Badge>
                ) : doc.is_verified ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border text-xs gap-1">
                    <CheckCircle size={10} /> Verified
                  </Badge>
                ) : isRejected ? (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <XCircle size={10} /> Rejected
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs gap-1">
                    <Clock size={10} /> Pending Review
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        {uploadedCount < KYC_DOC_TYPES.length && (
          <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
            <Link to="/profile">
              <Upload size={14} className="mr-2" />
              Upload Missing Documents
            </Link>
          </Button>
        )}
        {uploadedCount > 0 && uploadedCount === KYC_DOC_TYPES.length && verifiedCount < KYC_DOC_TYPES.length && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            <AlertTriangle size={12} className="inline mr-1" />
            Documents submitted — awaiting admin review
          </p>
        )}
      </CardContent>
    </Card>
  );
}
