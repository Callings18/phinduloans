import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface DocumentChecklistProps {
  loanId: string;
  userId: string;
}

interface ApplicationDocument {
  id: string;
  doc_label: string;
  doc_type: string;
  file_url: string;
  status: string | null;
  notes: string | null;
  is_required: boolean | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  verified: { label: "Verified", icon: CheckCircle, color: "text-success" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-destructive" },
  submitted: { label: "Submitted", icon: Clock, color: "text-warning" },
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  uploaded: { label: "Pending Review", icon: Clock, color: "text-warning" },
};

// Defensive fallback for legacy rows whose `status` is null or an unknown value.
const FALLBACK_STATUS_CONFIG = { label: "Unknown", icon: Clock, color: "text-muted-foreground" } as const;

export default function DocumentChecklist({ loanId, userId }: DocumentChecklistProps) {
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["document-checklist", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", loanId)
        .order("doc_type", { ascending: true });

      if (error) throw error;
      return data as ApplicationDocument[];
    },
    enabled: !!loanId,
  });

  const handleReupload = async (doc: ApplicationDocument, file: File) => {
    setUploading(doc.id);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${loanId}/${doc.doc_type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("application_documents")
        .update({
          file_url: fileName,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: "submitted",
          notes: null,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      toast.success(`${doc.doc_label} re-uploaded successfully`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return null;
  }

  const rejectedDocs = documents.filter((d) => d.status === "rejected");
  const verifiedDocs = documents.filter((d) => d.status === "verified");
  const pendingDocs = documents.filter(
    (d) => !d.status || d.status === "submitted" || d.status === "pending" || d.status === "uploaded"
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          Document Verification Status
        </CardTitle>
        {rejectedDocs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle size={14} />
            {rejectedDocs.length} document(s) need re-upload
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((doc) => {
          const statusKey = doc.status ?? "pending";
          const config = statusConfig[statusKey] ?? FALLBACK_STATUS_CONFIG;
          const StatusIcon = config.icon;
          const isRejected = doc.status === "rejected";
          const docLabel =
            (doc.doc_label && doc.doc_label.trim()) ||
            (doc.doc_type && doc.doc_type.trim()) ||
            "Untitled document";

          return (
            <div
              key={doc.id}
              className={`flex items-start justify-between p-3 rounded-lg border ${
                isRejected
                  ? "border-destructive/30 bg-destructive/5"
                  : doc.status === "verified"
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <StatusIcon size={18} className={`${config.color} mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{docLabel}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${config.color} border-current`}
                    >
                      {config.label}
                    </Badge>
                    {doc.is_required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  {isRejected && doc.notes && (
                    <p className="text-xs text-destructive mt-1">
                      Reason: {doc.notes}
                    </p>
                  )}
                </div>
              </div>

              {isRejected && (
                <div className="ml-3">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleReupload(doc, file);
                      }}
                      disabled={uploading === doc.id}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={uploading === doc.id}
                      asChild
                    >
                      <span>
                        {uploading === doc.id ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Upload size={12} className="mr-1" />
                        )}
                        Re-upload
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary */}
        <div className="flex gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-success" />
            {verifiedDocs.length} verified
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-warning" />
            {pendingDocs.length} pending
          </span>
          {rejectedDocs.length > 0 && (
            <span className="flex items-center gap-1">
              <XCircle size={12} className="text-destructive" />
              {rejectedDocs.length} rejected
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
