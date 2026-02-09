import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/utils/storageHelpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, ShieldCheck, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

interface ApplicationDocumentsTabProps {
  selectedApp: any;
}

// Map doc_type to emoji icon
const docTypeIcons: Record<string, string> = {
  NRC_FRONT: "🪪",
  NRC_BACK: "🪪",
  SELFIE: "📸",
  PAYSLIP: "📄",
  BANK_STATEMENT: "🏦",
  EMPLOYER_LETTER: "✉️",
  COLLATERAL_DOC: "🖼️",
  GUARANTOR_DOC: "👥",
  CONTRACT_SIGNED: "📝",
  CONTRACT_UNSIGNED: "📋",
  PROOF_OF_RESIDENCE: "🏠",
  OTHER: "📎",
};

const getDocIcon = (docType: string): string => {
  return docTypeIcons[docType?.toUpperCase()] || "📎";
};

const statusBadgeConfig: Record<string, string> = {
  uploaded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  verified: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  pending_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

// Legacy column mapping: column name → doc metadata
const legacyDocColumns = [
  { key: "nrc_front_url", docType: "NRC_FRONT", label: "NRC Front" },
  { key: "nrc_back_url", docType: "NRC_BACK", label: "NRC Back" },
  { key: "selfie_url", docType: "SELFIE", label: "Selfie / Photo ID" },
  { key: "payslip_url", docType: "PAYSLIP", label: "Payslip 1 (Latest)" },
  { key: "payslip_2_url", docType: "PAYSLIP", label: "Payslip 2" },
  { key: "payslip_3_url", docType: "PAYSLIP", label: "Payslip 3" },
  { key: "bank_statement_url", docType: "BANK_STATEMENT", label: "Bank Statement" },
  { key: "employer_letter_url", docType: "EMPLOYER_LETTER", label: "Employer Letter" },
  { key: "collateral_image_url", docType: "COLLATERAL_DOC", label: "Collateral Image 1" },
  { key: "collateral_image_2_url", docType: "COLLATERAL_DOC", label: "Collateral Image 2" },
  { key: "collateral_image_3_url", docType: "COLLATERAL_DOC", label: "Collateral Image 3" },
  { key: "signed_contract_url", docType: "CONTRACT_SIGNED", label: "Signed Contract" },
  { key: "contract_url", docType: "CONTRACT_UNSIGNED", label: "Generated Contract" },
];

interface UnifiedDoc {
  id: string;
  docType: string;
  label: string;
  fileUrl: string;
  source: "application_documents" | "legacy";
  uploadedBy?: string | null;
  status?: string | null;
  payslipPassword?: string | null;
  monthTag?: string | null;
  notes?: string | null;
}

const ApplicationDocumentsTab = ({ selectedApp }: ApplicationDocumentsTabProps) => {
  const { toast } = useToast();

  // Fetch documents from application_documents table
  const { data: appDocuments, isLoading } = useQuery({
    queryKey: ["application-documents", selectedApp?.id],
    queryFn: async () => {
      const applicationId = selectedApp?.id;
      const { data, error } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", applicationId)
        .order("doc_type", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedApp?.id,
  });

  // Build merged + deduplicated document list
  const { mergedDocs, payslipPasswords } = useMemo(() => {
    const docs: UnifiedDoc[] = [];
    const seenUrls = new Set<string>();
    const passwords: string[] = [];

    // 1. Add all application_documents rows (primary source)
    if (appDocuments) {
      for (const doc of appDocuments) {
        const normalizedUrl = (doc.file_url as string)?.trim();
        if (!normalizedUrl) continue;
        seenUrls.add(normalizedUrl);
        const docType = doc.doc_type;
        docs.push({
          id: doc.id,
          docType: docType,
          label: doc.doc_label || docType,
          fileUrl: normalizedUrl,
          source: "application_documents",
          uploadedBy: doc.uploaded_by,
          status: doc.status,
          payslipPassword: doc.payslip_password,
          monthTag: doc.month_tag,
          notes: doc.notes,
        });
        if (doc.payslip_password) {
          passwords.push(doc.payslip_password);
        }
      }
    }

    // 2. Add legacy column docs that aren't already in the list
    if (selectedApp) {
      for (const col of legacyDocColumns) {
        const url = selectedApp[col.key];
        if (!url) continue;
        const normalizedUrl = url.trim();
        if (seenUrls.has(normalizedUrl)) continue;
        seenUrls.add(normalizedUrl);
        docs.push({
          id: `legacy-${col.key}`,
          docType: col.docType,
          label: col.label,
          fileUrl: normalizedUrl,
          source: "legacy",
          uploadedBy: "borrower",
          status: null,
        });
      }
    }

    // 3. Collect legacy payslip password
    if (selectedApp?.payslip_password) {
      const legacyPwd = selectedApp.payslip_password;
      if (!passwords.includes(legacyPwd)) {
        passwords.push(legacyPwd);
      }
    }

    return { mergedDocs: docs, payslipPasswords: passwords };
  }, [appDocuments, selectedApp]);

  const handleViewDocument = async (fileUrl: string) => {
    // If already a full URL, open directly
    if (fileUrl.startsWith("http")) {
      window.open(fileUrl, "_blank");
      return;
    }
    const signedUrl = await getSignedUrl(fileUrl);
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    } else {
      toast({
        title: "Error",
        description: "Failed to load document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm mt-2">Loading documents…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payslip Passwords */}
      {payslipPasswords.length > 0 && (
        <Card className="bg-warning/10 border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-warning" />
              <span className="text-sm font-semibold text-warning">
                Payslip Password{payslipPasswords.length > 1 ? "s" : ""}
              </span>
            </div>
            {payslipPasswords.map((pwd, i) => (
              <p key={i} className="text-lg font-mono font-bold text-foreground select-all">
                {pwd}
              </p>
            ))}
            <p className="text-xs text-muted-foreground mt-1">
              Use {payslipPasswords.length > 1 ? "these passwords" : "this password"} to open the borrower's payslip PDF files
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document count summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {mergedDocs.length} document{mergedDocs.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Documents grid */}
      {mergedDocs.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed rounded-xl border-border bg-secondary/10">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-20" />
          <p className="text-muted-foreground text-sm">No documents attached to this application.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mergedDocs.map((doc) => (
            <Card
              key={doc.id}
              className="bg-secondary/20 border-border/30 hover:border-primary/30 transition-colors"
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg flex-shrink-0">{getDocIcon(doc.docType)}</span>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground font-medium block truncate">
                        {doc.label}
                        {doc.monthTag && (
                          <span className="text-muted-foreground ml-1">({doc.monthTag})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {doc.uploadedBy && (
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {doc.uploadedBy}
                          </span>
                        )}
                        {doc.status && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${statusBadgeConfig[doc.status] || ""}`}
                          >
                            {doc.status}
                          </Badge>
                        )}
                        {doc.payslipPassword && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/20 text-warning border-warning/30">
                            🔒 has password
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 ml-2"
                    onClick={() => handleViewDocument(doc.fileUrl)}
                  >
                    <ExternalLink size={12} className="mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApplicationDocumentsTab;
