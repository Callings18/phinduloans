import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
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

interface StaffChecklistItem {
  id: string;
  document_type: string;
  document_name: string;
  is_required: boolean;
  is_submitted: boolean;
  is_verified: boolean;
  rejection_reason: string | null;
  file_url: string | null;
  notes: string | null;
}

type DisplayDoc = {
  key: string;
  label: string;
  docType: string;
  status: string;
  notes: string | null;
  isRequired: boolean;
  source: "application" | "checklist";
  applicationDocId?: string;
  checklistId?: string;
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  verified: { label: "Verified", icon: CheckCircle, color: "text-success" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-destructive" },
  submitted: { label: "Submitted", icon: Clock, color: "text-warning" },
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  uploaded: { label: "Pending Review", icon: Clock, color: "text-warning" },
  requested: { label: "Action Required", icon: AlertTriangle, color: "text-destructive" },
};

const FALLBACK_STATUS_CONFIG = { label: "Unknown", icon: Clock, color: "text-muted-foreground" } as const;

export default function DocumentChecklist({ loanId, userId }: DocumentChecklistProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["borrower-document-status", loanId],
    queryFn: async () => {
      const [appDocsRes, checklistRes] = await Promise.all([
        supabase
          .from("application_documents")
          .select("*")
          .eq("application_id", loanId)
          .order("doc_type", { ascending: true }),
        supabase
          .from("document_checklists")
          .select("id, document_type, document_name, is_required, is_submitted, is_verified, rejection_reason, file_url, notes")
          .eq("loan_id", loanId)
          .order("created_at", { ascending: true }),
      ]);

      if (appDocsRes.error) throw appDocsRes.error;
      if (checklistRes.error) throw checklistRes.error;

      return {
        applicationDocuments: (appDocsRes.data ?? []) as ApplicationDocument[],
        checklistItems: (checklistRes.data ?? []) as StaffChecklistItem[],
      };
    },
    enabled: !!loanId,
  });

  useEffect(() => {
    if (!loanId) return;
    const channel = supabase
      .channel(`borrower-docs-${loanId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_documents" },
        () => queryClient.invalidateQueries({ queryKey: ["borrower-document-status", loanId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_checklists", filter: `loan_id=eq.${loanId}` },
        () => queryClient.invalidateQueries({ queryKey: ["borrower-document-status", loanId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loanId, queryClient]);

  const displayDocs: DisplayDoc[] = useMemo(() => {
    const applicationDocuments = data?.applicationDocuments ?? [];
    const checklistItems = data?.checklistItems ?? [];
    const byType = new Map<string, DisplayDoc>();

    for (const doc of applicationDocuments) {
      byType.set(doc.doc_type, {
        key: doc.id,
        label: doc.doc_label?.trim() || doc.doc_type,
        docType: doc.doc_type,
        status: doc.status ?? "pending",
        notes: doc.notes,
        isRequired: doc.is_required !== false,
        source: "application",
        applicationDocId: doc.id,
      });
    }

    for (const item of checklistItems) {
      const existing = byType.get(item.document_type);
      if (existing) {
        if (item.is_verified) existing.status = "verified";
        else if (item.rejection_reason) {
          existing.status = "rejected";
          existing.notes = item.rejection_reason;
        } else if (item.is_submitted && existing.status === "pending") {
          existing.status = "submitted";
        }
        existing.checklistId = item.id;
        continue;
      }

      let status = "requested";
      if (item.is_verified) status = "verified";
      else if (item.rejection_reason) status = "rejected";
      else if (item.is_submitted) status = "submitted";

      byType.set(item.document_type, {
        key: item.id,
        label: item.document_name,
        docType: item.document_type,
        status,
        notes: item.rejection_reason || item.notes,
        isRequired: item.is_required,
        source: "checklist",
        checklistId: item.id,
      });
    }

    return Array.from(byType.values());
  }, [data]);

  const uploadDocument = async (doc: DisplayDoc, file: File) => {
    setUploading(doc.key);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${loanId}/${doc.docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Borrowers can INSERT but not UPDATE application_documents (RLS) — always insert a new row on re-upload.
      const { error: insertError } = await supabase.from("application_documents").insert({
        application_id: loanId,
        borrower_id: userId,
        doc_type: doc.docType,
        doc_label: doc.label,
        file_name: file.name,
        file_url: fileName,
        file_size: file.size,
        mime_type: file.type,
        is_required: doc.isRequired,
        status: "pending_review",
      });
      if (insertError) throw insertError;

      if (doc.checklistId) {
        await supabase
          .from("document_checklists")
          .update({ is_submitted: true, file_url: fileName, rejection_reason: null })
          .eq("id", doc.checklistId);
      }

      toast.success(`${doc.label} uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ["borrower-document-status", loanId] });
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

  if (displayDocs.length === 0) return null;

  const rejectedDocs = displayDocs.filter((d) => d.status === "rejected");
  const verifiedDocs = displayDocs.filter((d) => d.status === "verified");
  const pendingDocs = displayDocs.filter((d) =>
    ["submitted", "pending", "uploaded"].includes(d.status),
  );
  const actionDocs = displayDocs.filter((d) => d.status === "requested" || d.status === "rejected");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          Document Verification Status
        </CardTitle>
        {actionDocs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle size={14} />
            {actionDocs.length} document(s) need your attention
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {displayDocs.map((doc) => {
          const config = statusConfig[doc.status] ?? FALLBACK_STATUS_CONFIG;
          const StatusIcon = config.icon;
          const needsUpload = doc.status === "rejected" || doc.status === "requested";

          return (
            <div
              key={doc.key}
              className={`flex items-start justify-between p-3 rounded-lg border ${
                needsUpload
                  ? "border-destructive/30 bg-destructive/5"
                  : doc.status === "verified"
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <StatusIcon size={18} className={`${config.color} mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{doc.label}</p>
                    <Badge variant="outline" className={`text-xs ${config.color} border-current`}>
                      {config.label}
                    </Badge>
                    {doc.isRequired && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                    {doc.source === "checklist" && doc.status === "requested" && (
                      <Badge variant="destructive" className="text-xs">Requested by reviewer</Badge>
                    )}
                  </div>
                  {doc.notes && (
                    <p className={`text-xs mt-1 ${doc.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                      {doc.status === "rejected" ? "Reason: " : ""}{doc.notes}
                    </p>
                  )}
                </div>
              </div>

              {needsUpload && (
                <div className="ml-3">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadDocument(doc, file);
                      }}
                      disabled={uploading === doc.key}
                    />
                    <Button size="sm" variant="outline" className="text-xs" disabled={uploading === doc.key} asChild>
                      <span>
                        {uploading === doc.key ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Upload size={12} className="mr-1" />
                        )}
                        {doc.status === "rejected" ? "Re-upload" : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-success" />
            {verifiedDocs.length} verified
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-warning" />
            {pendingDocs.length} pending
          </span>
          {actionDocs.length > 0 && (
            <span className="flex items-center gap-1">
              <XCircle size={12} className="text-destructive" />
              {actionDocs.length} action needed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
