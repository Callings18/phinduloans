import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/utils/storageHelpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ExternalLink, FileText, ShieldCheck, Loader2, Upload, CheckCircle,
  Clock, AlertTriangle, Eye, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";
import { toast as sonnerToast } from "sonner";

interface ApplicationDocumentsTabProps {
  selectedApp: any;
}

// Map doc_type to emoji icon
const docTypeIcons: Record<string, string> = {
  NRC_FRONT: "🪪", NRC_BACK: "🪪", SELFIE: "📸", PAYSLIP: "📄",
  BANK_STATEMENT: "🏦", EMPLOYER_LETTER: "✉️", COLLATERAL_DOC: "🖼️",
  GUARANTOR_DOC: "👥", CONTRACT_SIGNED: "📝", CONTRACT_UNSIGNED: "📋",
  PROOF_OF_RESIDENCE: "🏠", OTHER: "📎",
  nrc_front: "🪪", nrc_back: "🪪", selfie: "📸", payslip: "📄",
  bank_statement: "🏦", employer_letter: "✉️", collateral: "🖼️",
  guarantor: "👥", contract: "📝", proof_of_residence: "🏠",
};

const getDocIcon = (docType: string): string =>
  docTypeIcons[docType] || docTypeIcons[docType?.toUpperCase()] || "📎";

// Legacy column mapping
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

interface UploadedDoc {
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

interface RequiredDocRow {
  docType: string;
  docName: string;
  isMandatory: boolean;
  uploadedDocs: UploadedDoc[];
  isUploaded: boolean;
}

const ApplicationDocumentsTab = ({ selectedApp }: ApplicationDocumentsTabProps) => {
  const { toast } = useToast();
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch documents from application_documents table
  const { data: appDocuments, isLoading } = useQuery({
    queryKey: ["application-documents", selectedApp?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", selectedApp?.id)
        .order("doc_type", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedApp?.id,
  });

  // Fetch loan product name and required documents
  const { data: loanProduct } = useQuery({
    queryKey: ["loan-product-info", selectedApp?.loan_product_id],
    queryFn: async () => {
      if (!selectedApp?.loan_product_id) return null;
      const { data, error } = await supabase
        .from("loan_products")
        .select("name, required_documents")
        .eq("id", selectedApp.loan_product_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedApp?.loan_product_id,
  });

  const productName = loanProduct?.name || "Unknown Product";
  const productDocuments = useMemo(() => {
    const docs = loanProduct?.required_documents as { document_type: string; document_name: string; is_mandatory: boolean }[] | null;
    return docs && docs.length > 0 ? docs : [];
  }, [loanProduct]);

  // Build all uploaded docs (unified + legacy)
  const { allUploadedDocs, payslipPasswords } = useMemo(() => {
    const docs: UploadedDoc[] = [];
    const seenUrls = new Set<string>();
    const passwords: string[] = [];

    if (appDocuments) {
      for (const doc of appDocuments) {
        const url = (doc.file_url as string)?.trim();
        if (!url) continue;
        seenUrls.add(url);
        docs.push({
          id: doc.id, docType: doc.doc_type, label: doc.doc_label || doc.doc_type,
          fileUrl: url, source: "application_documents", uploadedBy: doc.uploaded_by,
          status: doc.status, payslipPassword: doc.payslip_password,
          monthTag: doc.month_tag, notes: doc.notes,
        });
        if (doc.payslip_password) passwords.push(doc.payslip_password);
      }
    }

    if (selectedApp) {
      for (const col of legacyDocColumns) {
        const url = selectedApp[col.key]?.trim();
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        docs.push({
          id: `legacy-${col.key}`, docType: col.docType, label: col.label,
          fileUrl: url, source: "legacy", uploadedBy: "borrower", status: null,
        });
      }
      if (selectedApp.payslip_password && !passwords.includes(selectedApp.payslip_password)) {
        passwords.push(selectedApp.payslip_password);
      }
    }

    return { allUploadedDocs: docs, payslipPasswords: passwords };
  }, [appDocuments, selectedApp]);

  // Build the full required document checklist with uploaded status
  const documentChecklist: RequiredDocRow[] = useMemo(() => {
    return productDocuments.map((reqDoc) => {
      const matchingUploads = allUploadedDocs.filter(
        (d) => d.docType && reqDoc.document_type && d.docType.toUpperCase() === reqDoc.document_type.toUpperCase()
      );
      return {
        docType: reqDoc.document_type,
        docName: reqDoc.document_name,
        isMandatory: reqDoc.is_mandatory,
        uploadedDocs: matchingUploads,
        isUploaded: matchingUploads.length > 0,
      };
    });
  }, [productDocuments, allUploadedDocs]);

  // Extra uploaded docs not in the required list
  const extraDocs = useMemo(() => {
    const requiredTypes = new Set(productDocuments.filter((d) => d.document_type).map((d) => d.document_type.toUpperCase()));
    return allUploadedDocs.filter((d) => d.docType && !requiredTypes.has(d.docType.toUpperCase()));
  }, [productDocuments, allUploadedDocs]);

  // Stats
  const totalRequired = documentChecklist.filter((d) => d.isMandatory).length;
  const uploadedMandatory = documentChecklist.filter((d) => d.isMandatory && d.isUploaded).length;
  const progressPercent = totalRequired > 0 ? Math.round((uploadedMandatory / totalRequired) * 100) : 0;

  const handleViewDocument = async (fileUrl: string) => {
    if (fileUrl.startsWith("http")) {
      window.open(fileUrl, "_blank");
      return;
    }
    const signedUrl = await getSignedUrl(fileUrl);
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    } else {
      toast({ title: "Error", description: "Failed to load document.", variant: "destructive" });
    }
  };

  // Direct file upload for a specific doc type
  const handleFileUpload = async (file: File, docType: string, docName: string) => {
    if (file.size > 10 * 1024 * 1024) {
      sonnerToast.error("File too large. Max 10MB.");
      return;
    }

    try {
      setUploadingDocType(docType);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const borrowerId = selectedApp?.user_id || "";
      const loanId = selectedApp?.id || "";
      const ext = file.name.split(".").pop() || "file";
      const filePath = `${borrowerId}/${loanId}/${docType}_admin_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("application_documents")
        .insert({
          application_id: loanId,
          borrower_id: borrowerId,
          doc_type: docType,
          doc_label: docName,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
          loan_product_id: selectedApp?.loan_product_id || null,
          status: "uploaded",
        });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["application-documents", loanId] });
      sonnerToast.success(`"${docName}" uploaded successfully`);
    } catch (err: any) {
      sonnerToast.error(err.message || "Upload failed");
    } finally {
      setUploadingDocType(null);
    }
  };

  const triggerFileInput = (docType: string) => {
    setUploadingDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocType) return;

    const docRow = documentChecklist.find((d) => d.docType === uploadingDocType);
    handleFileUpload(file, uploadingDocType, docRow?.docName || uploadingDocType);
    e.target.value = "";
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Loan Product Info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Loan Product: {productName}</p>
              <p className="text-xs text-muted-foreground">
                {totalRequired} mandatory document{totalRequired !== 1 ? "s" : ""} required
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{uploadedMandatory}/{totalRequired}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Uploaded</p>
            </div>
          </div>
          <Progress value={progressPercent} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-1">{progressPercent}% complete</p>
        </CardContent>
      </Card>

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
              <p key={i} className="text-lg font-mono font-bold text-foreground select-all">{pwd}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Required Documents Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Required Documents</CardTitle>
          <CardDescription>
            {productDocuments.length === 0
              ? "Required documents are configured per loan product. Configure them in Admin → Loan Products for this product."
              : "Documents required for this loan product. Upload missing documents on behalf of the borrower."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {productDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-70" />
              <p className="font-medium">No required documents configured for this product.</p>
              <p className="mt-1">Configure required documents in Admin → Loan Products for this application&apos;s product.</p>
            </div>
          ) : (
          documentChecklist.map((row) => (
            <div
              key={row.docType}
              className={`rounded-lg border p-3 transition-colors ${
                row.isUploaded
                  ? "border-success/30 bg-success/5"
                  : row.isMandatory
                  ? "border-warning/30 bg-warning/5"
                  : "border-border bg-secondary/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">{getDocIcon(row.docType)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{row.docName}</span>
                      {row.isMandatory && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Required
                        </Badge>
                      )}
                    </div>
                    {row.isUploaded ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle size={12} className="text-success" />
                        <span className="text-xs text-success">
                          {row.uploadedDocs.length} file{row.uploadedDocs.length > 1 ? "s" : ""} uploaded
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        {row.isMandatory ? (
                          <>
                            <AlertTriangle size={12} className="text-warning" />
                            <span className="text-xs text-warning">Pending — not yet uploaded</span>
                          </>
                        ) : (
                          <>
                            <Clock size={12} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Optional — not uploaded</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* View buttons for each uploaded file */}
                  {row.uploadedDocs.map((doc, idx) => (
                    <Button
                      key={doc.id}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleViewDocument(doc.fileUrl)}
                      title={`View ${doc.label}`}
                    >
                      <Eye size={14} />
                      {row.uploadedDocs.length > 1 && (
                        <span className="ml-0.5 text-xs">{idx + 1}</span>
                      )}
                    </Button>
                  ))}

                  {/* Upload button */}
                  <Button
                    variant={row.isUploaded ? "outline" : "default"}
                    size="sm"
                    className="h-8"
                    onClick={() => triggerFileInput(row.docType)}
                    disabled={uploadingDocType === row.docType}
                  >
                    {uploadingDocType === row.docType ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    <span className="ml-1 hidden sm:inline">Upload</span>
                  </Button>
                </div>
              </div>

              {/* Show uploaded file details */}
              {row.uploadedDocs.length > 0 && (
                <div className="mt-2 space-y-1 pl-8">
                  {row.uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText size={10} />
                      <span className="truncate">{doc.label}</span>
                      {doc.monthTag && <span>({doc.monthTag})</span>}
                      {doc.status && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${
                            doc.status === "verified" ? "bg-success/20 text-success border-success/30" :
                            doc.status === "rejected" ? "bg-destructive/20 text-destructive border-destructive/30" :
                            "bg-info/20 text-info border-info/30"
                          }`}
                        >
                          {doc.status}
                        </Badge>
                      )}
                      {doc.payslipPassword && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-warning/20 text-warning border-warning/30">
                          🔒 pwd
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
          )}
        </CardContent>
      </Card>

      {/* Extra uploaded documents not in required list */}
      {extraDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Documents</CardTitle>
            <CardDescription>Documents uploaded that are not in the required list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {extraDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{getDocIcon(doc.docType)}</span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{doc.label}</span>
                      {doc.status && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">
                          {doc.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleViewDocument(doc.fileUrl)}
                  >
                    <Eye size={14} className="mr-1" /> View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApplicationDocumentsTab;
