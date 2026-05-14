import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/utils/storageHelpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ExternalLink, FileText, ShieldCheck, Loader2, Upload, CheckCircle,
  Clock, AlertTriangle, Eye, Package, X, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  BUSINESS_REGISTRATION: "🏢", BUSINESS_BANK_STATEMENT: "🏦",
  TAX_COMPLIANCE: "📋", BUSINESS_PLAN: "📊",
  COLLATERAL_OWNERSHIP: "📜", COLLATERAL_VALUATION: "💰",
  COLLATERAL_PHOTOS: "📷", PROOF_OF_INCOME: "💵",
  VEHICLE_REGISTRATION: "🚗", VEHICLE_VALUATION: "🚗", VEHICLE_PHOTOS: "📷",
  GUARANTOR_NRC: "🪪", GUARANTOR_PAYSLIP: "📄",
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
  fileName?: string;
  source: "application_documents" | "legacy";
  uploadedBy?: string | null;
  status?: string | null;
  payslipPassword?: string | null;
  monthTag?: string | null;
  notes?: string | null;
}

interface RequiredDocRow {
  rowId: string;
  docType: string;
  docName: string;
  isMandatory: boolean;
  category: string;
  uploadedDocs: UploadedDoc[];
  isUploaded: boolean;
}

// Category display configuration
const CATEGORY_CONFIG: Record<string, { icon: string; title: string; description: string }> = {
  identity: { icon: "🪪", title: "Identity Documents", description: "KYC and identity verification documents" },
  kyc: { icon: "🪪", title: "KYC / Identity Documents", description: "Identity verification documents required for all products" },
  bank_statements: { icon: "🏦", title: "Bank Statements", description: "Monthly bank statements for income verification" },
  payslips: { icon: "📄", title: "Payslips", description: "Employment payslip documents" },
  proof_employment: { icon: "✉️", title: "Proof & Employment", description: "Proof of residence and employment documents" },
  business: { icon: "🏢", title: "Business Documents", description: "Business registration and financial documents" },
  collateral: { icon: "🖼️", title: "Collateral Documents", description: "Collateral ownership and valuation documents" },
  required: { icon: "📋", title: "Required Documents", description: "Documents required for this loan product" },
  optional: { icon: "📎", title: "Optional Documents", description: "Additional supporting documents (not mandatory)" },
};

const ApplicationDocumentsTab = ({ selectedApp }: ApplicationDocumentsTabProps) => {
  const { toast } = useToast();
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLabel, setViewerLabel] = useState<string>("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerIsImage, setViewerIsImage] = useState(false);
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

  // Fetch KYC documents from borrower_document_vault
  const { data: vaultDocs } = useQuery({
    queryKey: ["borrower-kyc-vault", selectedApp?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("*")
        .eq("borrower_id", selectedApp?.user_id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedApp?.user_id,
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
    const raw = loanProduct?.required_documents as { doc_type?: string; document_type?: string; doc_label?: string; document_name?: string; is_mandatory: boolean; category?: string; display_order?: number }[] | null;
    if (!raw || raw.length === 0) return [];
    return raw.map((d) => {
      const name = d.doc_label || d.document_name || '';
      const generatedType = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      return {
        document_type: d.doc_type || d.document_type || generatedType,
        document_name: name,
        is_mandatory: d.is_mandatory ?? true,
        category: d.category || 'required',
        display_order: d.display_order ?? 0,
      };
    }).sort((a, b) => a.display_order - b.display_order);
  }, [loanProduct]);

  // Map vault doc_type to product doc_type (uppercase) with aliases
  const vaultToProductType: Record<string, string> = {
    nrc_front: "NRC_FRONT",
    nrc_back: "NRC_BACK",
    selfie: "SELFIE",
    selfie_holding_nrc: "SELFIE_HOLDING_NRC",
    proof_of_residence: "PROOF_OF_RESIDENCE",
    proof_of_residence_utility_bill: "PROOF_OF_RESIDENCE_UTILITY_BILL",
    payslip: "PAYSLIP",
    payslip_1: "PAYSLIP",
    payslip_latest: "PAYSLIP",
    bank_statement: "BANK_STATEMENT",
    employer_letter: "EMPLOYER_LETTER",
    collateral: "COLLATERAL_DOC",
    collateral_image: "COLLATERAL_DOC",
    collateral_photos: "COLLATERAL_PHOTOS",
    guarantor: "GUARANTOR_DOC",
    guarantor_nrc: "GUARANTOR_NRC",
    guarantor_payslip: "GUARANTOR_PAYSLIP",
    business_registration: "BUSINESS_REGISTRATION",
    tax_compliance: "TAX_COMPLIANCE",
  };

  // Normalize a doc type for matching: strip underscores/hyphens, uppercase
  const normalizeDocType = (type: string): string => 
    type.toUpperCase().replace(/[-_\s]+/g, '').replace(/[^A-Z0-9]/g, '');

  // EXACT match only to prevent cross-matching (bank_statement_1 ≠ bank_statement_2)
  const docTypesMatch = (uploadedType: string, requiredType: string): boolean => {
    const normUploaded = normalizeDocType(uploadedType);
    const normRequired = normalizeDocType(requiredType);
    if (normUploaded === normRequired) return true;
    const aliasMap: Record<string, string[]> = {
      'SELFIE': ['SELFIEHOLDINGNRC'],
      'SELFIEHOLDINGNRC': ['SELFIE'],
      'NRCFRONT': ['NRC_FRONT', 'NRCFRONT'],
      'NRCBACK': ['NRC_BACK', 'NRCBACK'],
    };
    const aliases = aliasMap[normUploaded];
    if (aliases && aliases.some(a => normalizeDocType(a) === normRequired)) return true;
    const reverseAliases = aliasMap[normRequired];
    if (reverseAliases && reverseAliases.some(a => normalizeDocType(a) === normUploaded)) return true;
    return false;
  };

  // Build all uploaded docs (unified + legacy + vault KYC)
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
          fileUrl: url, fileName: doc.file_name, source: "application_documents",
          uploadedBy: doc.uploaded_by, status: doc.status,
          payslipPassword: doc.payslip_password, monthTag: doc.month_tag, notes: doc.notes,
        });
        if (doc.payslip_password) passwords.push(doc.payslip_password);
      }
    }

    // Merge KYC docs from borrower_document_vault
    if (vaultDocs) {
      const seenVaultTypes = new Set<string>();
      for (const vDoc of vaultDocs) {
        const url = vDoc.file_url?.trim();
        if (!url || seenUrls.has(url)) continue;
        if (seenVaultTypes.has(vDoc.doc_type)) continue;
        seenVaultTypes.add(vDoc.doc_type);
        seenUrls.add(url);
        const mappedType = vaultToProductType[vDoc.doc_type] || vDoc.doc_type;
        docs.push({
          id: vDoc.id, docType: mappedType, label: vDoc.doc_label || vDoc.doc_type,
          fileUrl: url, source: "application_documents", uploadedBy: "borrower",
          status: vDoc.is_verified ? "verified" : "pending", notes: vDoc.notes,
        });
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
  }, [appDocuments, vaultDocs, selectedApp]);

  // Build the full required document checklist with uploaded status
  const documentChecklist: RequiredDocRow[] = useMemo(() => {
    const claimedDocIds = new Set<string>();
    
    return productDocuments.map((reqDoc, index) => {
      const matchingUploads = allUploadedDocs.filter(
        (d) => {
          if (claimedDocIds.has(d.id)) return false;
          if (d.docType && reqDoc.document_type && docTypesMatch(d.docType, reqDoc.document_type)) return true;
          if (d.label && reqDoc.document_name && d.label.toLowerCase().trim() === reqDoc.document_name.toLowerCase().trim()) return true;
          return false;
        }
      );
      
      const claimedDocs = matchingUploads.length > 0 ? [matchingUploads[0]] : [];
      claimedDocs.forEach(d => claimedDocIds.add(d.id));
      
      return {
        rowId: `${reqDoc.document_type}_${index}`,
        docType: reqDoc.document_type,
        docName: reqDoc.document_name,
        isMandatory: reqDoc.is_mandatory,
        category: reqDoc.category || 'required',
        uploadedDocs: claimedDocs,
        isUploaded: claimedDocs.length > 0,
      };
    });
  }, [productDocuments, allUploadedDocs]);

  // Group checklist by category (preserving actual categories from product config)
  const groupedDocs = useMemo(() => {
    const groups: Record<string, RequiredDocRow[]> = {};
    for (const row of documentChecklist) {
      const cat = row.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(row);
    }
    return groups;
  }, [documentChecklist]);

  // Extra uploaded docs not in the required list
  const extraDocs = useMemo(() => {
    const claimedIds = new Set(documentChecklist.flatMap(r => r.uploadedDocs.map(d => d.id)));
    return allUploadedDocs.filter((d) => !claimedIds.has(d.id));
  }, [documentChecklist, allUploadedDocs]);

  // Stats
  const totalRequired = documentChecklist.filter((d) => d.isMandatory).length;
  const uploadedMandatory = documentChecklist.filter((d) => d.isMandatory && d.isUploaded).length;
  const progressPercent = totalRequired > 0 ? Math.round((uploadedMandatory / totalRequired) * 100) : 0;

  // Determine if a URL is an image based on file path (before query params)
  const isImageUrl = (url: string): boolean => {
    const pathOnly = url.split('?')[0].split('#')[0];
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathOnly);
  };

  const handleViewDocument = async (fileUrl: string, label?: string, fileName?: string) => {
    setViewerLabel(label || "Document");
    setViewerLoading(true);
    setViewerUrl(null);
    setViewerIsImage(false);
    try {
      let url = fileUrl;
      // Check original path for file type before signing
      const isImg = isImageUrl(fileUrl) || (fileName && isImageUrl(fileName));
      if (!fileUrl.startsWith("http")) {
        const signed = await getSignedUrl(fileUrl);
        if (!signed) {
          toast({ title: "Error", description: "Failed to load document.", variant: "destructive" });
          setViewerLoading(false);
          return;
        }
        url = signed;
      }
      setViewerIsImage(!!isImg);
      setViewerUrl(url);
    } catch {
      toast({ title: "Error", description: "Failed to load document.", variant: "destructive" });
    } finally {
      setViewerLoading(false);
    }
  };

  // Verify / Reject document mutations
  const verifyDocMutation = useMutation({
    mutationFn: async ({ docId, status }: { docId: string; status: "verified" | "rejected" }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("application_documents")
        .update({
          status,
          verified_by: user?.id || null,
          verified_at: new Date().toISOString(),
        })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application-documents", selectedApp?.id] });
      sonnerToast.success(`Document ${variables.status === "verified" ? "verified" : "rejected"}`);
    },
    onError: (error: any) => {
      sonnerToast.error(error.message || "Failed to update document status");
    },
  });

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

      await queryClient.invalidateQueries({ queryKey: ["application-documents", loanId] });
      await queryClient.refetchQueries({ queryKey: ["application-documents", loanId] });
      sonnerToast.success(`"${docName}" uploaded successfully`);
    } catch (err: any) {
      sonnerToast.error(err.message || "Upload failed");
    } finally {
      setUploadingDocType(null);
      setUploadingRowId(null);
    }
  };

  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const pendingUploadRef = useRef<{ docType: string; docName: string } | null>(null);

  const triggerFileInput = (rowId: string, docType: string, docName: string) => {
    setUploadingRowId(rowId);
    setUploadingDocType(docType);
    pendingUploadRef.current = { docType, docName };
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadRef.current) {
      setUploadingRowId(null);
      setUploadingDocType(null);
      return;
    }

    const { docType, docName } = pendingUploadRef.current;
    pendingUploadRef.current = null;
    e.target.value = "";
    await handleFileUpload(file, docType, docName);
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const config: Record<string, string> = {
      verified: "bg-success/20 text-success border-success/30",
      rejected: "bg-destructive/20 text-destructive border-destructive/30",
      uploaded: "bg-info/20 text-info border-info/30",
      pending: "bg-info/20 text-info border-info/30",
      submitted: "bg-warning/20 text-warning border-warning/30",
    };
    return (
      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${config[status] || config.uploaded}`}>
        {status}
      </Badge>
    );
  };

  const renderDocRow = (row: RequiredDocRow) => (
    <div
      key={row.rowId}
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
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Required</Badge>
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
          {row.uploadedDocs.map((doc, idx) => (
            <Button key={doc.id} variant="ghost" size="sm" className="h-8 px-2"
              onClick={() => handleViewDocument(doc.fileUrl, doc.label, doc.fileName)} title={`View ${doc.label}`}>
              <Eye size={14} />
              {row.uploadedDocs.length > 1 && <span className="ml-0.5 text-xs">{idx + 1}</span>}
            </Button>
          ))}
          <Button variant={row.isUploaded ? "outline" : "default"} size="sm" className="h-8"
            onClick={() => triggerFileInput(row.rowId, row.docType, row.docName)} disabled={uploadingRowId === row.rowId}>
            {uploadingRowId === row.rowId ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span className="ml-1 hidden sm:inline">Upload</span>
          </Button>
        </div>
      </div>
      {/* Uploaded doc details with verify/reject actions */}
      {row.uploadedDocs.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-8">
          {row.uploadedDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <FileText size={10} className="flex-shrink-0" />
                <span className="truncate">{doc.label}</span>
                {doc.monthTag && <span>({doc.monthTag})</span>}
                {getStatusBadge(doc.status)}
                {doc.payslipPassword && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-warning/20 text-warning border-warning/30">🔒 pwd</Badge>
                )}
              </div>
              {/* Verify / Reject buttons for application_documents (not legacy) */}
              {doc.source === "application_documents" && !doc.id.startsWith("legacy-") && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {doc.status !== "verified" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-success hover:bg-success/10"
                      onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: "verified" })}
                      disabled={verifyDocMutation.isPending}
                      title="Verify document"
                    >
                      <ThumbsUp size={12} />
                    </Button>
                  )}
                  {doc.status !== "rejected" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: "rejected" })}
                      disabled={verifyDocMutation.isPending}
                      title="Reject document"
                    >
                      <ThumbsDown size={12} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

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

      {/* Documents by Category */}
      {productDocuments.length === 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Required Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-70" />
              <p className="font-medium">No required documents configured for this product.</p>
              <p className="mt-1">Configure required documents in Admin → Loan Products.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Render each category group */}
          {Object.entries(groupedDocs).map(([category, rows]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.required;
            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {config.icon} {config.title}
                  </CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rows.map((row) => renderDocRow(row))}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

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
                      {getStatusBadge(doc.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleViewDocument(doc.fileUrl, doc.label, doc.fileName)}
                    >
                      <Eye size={14} className="mr-1" /> View
                    </Button>
                    {/* Verify/Reject for extra docs too */}
                    {doc.source === "application_documents" && !doc.id.startsWith("legacy-") && (
                      <>
                        {doc.status !== "verified" && (
                          <Button variant="ghost" size="sm" className="h-8 px-1.5 text-success hover:bg-success/10"
                            onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: "verified" })}
                            disabled={verifyDocMutation.isPending} title="Verify">
                            <ThumbsUp size={12} />
                          </Button>
                        )}
                        {doc.status !== "rejected" && (
                          <Button variant="ghost" size="sm" className="h-8 px-1.5 text-destructive hover:bg-destructive/10"
                            onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: "rejected" })}
                            disabled={verifyDocMutation.isPending} title="Reject">
                            <ThumbsDown size={12} />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* In-app Document Viewer Dialog */}
      <Dialog open={!!viewerUrl || viewerLoading} onOpenChange={(open) => { if (!open) { setViewerUrl(null); setViewerLabel(""); } }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{viewerLabel}</span>
              {viewerUrl && (
                <Button variant="ghost" size="sm" onClick={() => window.open(viewerUrl, "_blank")} className="ml-2 flex-shrink-0">
                  <ExternalLink size={14} className="mr-1" /> Open in new tab
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            {viewerLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : viewerUrl ? (
              viewerIsImage ? (
                <img src={viewerUrl} alt={viewerLabel} className="max-w-full max-h-full object-contain mx-auto" />
              ) : (
                <iframe src={viewerUrl} className="w-full h-full border-0 rounded-lg" title={viewerLabel} />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApplicationDocumentsTab;
