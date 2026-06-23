import { useState, useRef } from "react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Input } from "@phinduloans/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { Upload, Loader2, FileText, Image as ImageIcon, X } from "lucide-react";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";

interface ProductDocument {
  document_type: string;
  document_name: string;
  is_mandatory: boolean;
}

const DEFAULT_DOC_TYPES = [
  { document_type: "NRC_FRONT", document_name: "NRC Front", is_mandatory: true },
  { document_type: "NRC_BACK", document_name: "NRC Back", is_mandatory: true },
  { document_type: "SELFIE", document_name: "Selfie / Photo ID", is_mandatory: true },
  { document_type: "PAYSLIP", document_name: "Payslip", is_mandatory: true },
  { document_type: "BANK_STATEMENT", document_name: "Bank Statement", is_mandatory: true },
  { document_type: "EMPLOYER_LETTER", document_name: "Employer Letter", is_mandatory: false },
  { document_type: "COLLATERAL_DOC", document_name: "Collateral Document", is_mandatory: false },
  { document_type: "GUARANTOR_DOC", document_name: "Guarantor Document", is_mandatory: false },
  { document_type: "CONTRACT_SIGNED", document_name: "Signed Contract", is_mandatory: false },
  { document_type: "PROOF_OF_RESIDENCE", document_name: "Proof of Residence", is_mandatory: false },
  { document_type: "OTHER", document_name: "Other Document", is_mandatory: false },
];

interface AdminDocumentUploadProps {
  loanId: string;
  borrowerId: string;
  loanProductId: string | null;
  productDocuments: ProductDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminDocumentUpload({
  loanId,
  borrowerId,
  loanProductId,
  productDocuments,
  open,
  onOpenChange,
}: AdminDocumentUploadProps) {
  const [selectedDocType, setSelectedDocType] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [monthTag, setMonthTag] = useState("");
  const [payslipPassword, setPayslipPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Build doc type options from product documents or defaults
  const docTypeOptions = productDocuments.length > 0
    ? productDocuments.map((d) => ({
        value: d.document_type,
        label: d.document_name,
      }))
    : DEFAULT_DOC_TYPES.map((d) => ({
        value: d.document_type,
        label: d.document_name,
      }));

  const selectedDocLabel = docTypeOptions.find((d) => d.value === selectedDocType)?.label || customLabel || selectedDocType;

  const isPayslipType = selectedDocType?.toUpperCase().includes("PAYSLIP");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setSelectedDocType("");
    setCustomLabel("");
    setMonthTag("");
    setPayslipPassword("");
    clearFile();
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !selectedDocType) throw new Error("Select a document type and file");

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Generate unique file path
      const ext = selectedFile.name.split(".").pop() || "file";
      const timestamp = Date.now();
      const filePath = `${borrowerId}/${loanId}/${selectedDocType}_admin_${timestamp}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Create application_documents record
      const docLabel = customLabel || selectedDocLabel;
      const { error: insertError } = await supabase
        .from("application_documents")
        .insert({
          application_id: loanId,
          borrower_id: borrowerId,
          doc_type: selectedDocType,
          doc_label: docLabel,
          file_name: selectedFile.name,
          file_url: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: user.id,
          loan_product_id: loanProductId,
          month_tag: monthTag || null,
          payslip_password: payslipPassword || null,
          status: "uploaded",
        });

      if (insertError) throw new Error(`Failed to save record: ${insertError.message}`);

      return { filePath, docLabel };
    },
    onSuccess: (result) => {
      // Invalidate all document-related queries
      queryClient.invalidateQueries({ queryKey: ["application-documents", loanId] });
      queryClient.invalidateQueries({ queryKey: ["application-documents-verify", loanId] });
      queryClient.invalidateQueries({ queryKey: ["document-checklist", loanId] });
      toast.success(`"${result.docLabel}" uploaded successfully`);
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload document");
    },
  });

  const isImage = selectedFile?.type.startsWith("image/");
  const isPdf = selectedFile?.type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} /> Upload Document on Behalf of Borrower
          </DialogTitle>
          <DialogDescription>
            Select the document type and upload the file. The borrower will see this in their document checklist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type..." />
              </SelectTrigger>
              <SelectContent>
                {docTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom label (optional override) */}
          <div className="space-y-2">
            <Label>Custom Label (optional)</Label>
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={selectedDocLabel || "e.g., Payslip - January 2026"}
            />
          </div>

          {/* Month tag for payslips */}
          {isPayslipType && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payslip Month</Label>
                <Input
                  type="month"
                  value={monthTag}
                  onChange={(e) => setMonthTag(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>PDF Password (if any)</Label>
                <Input
                  value={payslipPassword}
                  onChange={(e) => setPayslipPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>File *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isImage && preview ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
                          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : isPdf ? (
                        <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="text-red-500" size={24} />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <FileText className="text-muted-foreground" size={24} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[250px]">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFile}>
                      <X size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to select file</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images, PDFs, or documents up to 10MB
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedDocType || !selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="animate-spin mr-2" size={14} />
            ) : (
              <Upload size={14} className="mr-2" />
            )}
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
