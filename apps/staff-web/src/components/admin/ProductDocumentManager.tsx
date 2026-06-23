import { useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@phinduloans/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@phinduloans/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@phinduloans/shared/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  FileCheck,
  Loader2,
  GripVertical,
} from "lucide-react";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ProductDocument {
  id: string;
  loan_product_id: string;
  document_type: string;
  document_name: string;
  description: string | null;
  is_mandatory: boolean;
  allowed_file_types: string[];
  max_file_size_mb: number;
  validity_days: number | null;
  can_reuse_previous: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const COMMON_DOCUMENT_TYPES = [
  { type: "nrc_front", name: "NRC (Front)", description: "National Registration Card - Front side" },
  { type: "nrc_back", name: "NRC (Back)", description: "National Registration Card - Back side" },
  { type: "payslip", name: "Latest Payslip", description: "Most recent payslip from employer" },
  { type: "payslip_2", name: "Second Payslip", description: "Second most recent payslip" },
  { type: "payslip_3", name: "Third Payslip", description: "Third most recent payslip" },
  { type: "bank_statement", name: "Bank Statement", description: "3 months bank statement" },
  { type: "employment_letter", name: "Employment Letter", description: "Letter confirming employment" },
  { type: "proof_of_residence", name: "Proof of Residence", description: "Utility bill or rental agreement" },
  { type: "tpin", name: "TPIN Certificate", description: "Tax Payer Identification Number" },
  { type: "business_registration", name: "Business Registration", description: "Business registration certificate" },
  { type: "selfie", name: "Selfie Photo", description: "Recent photo for identity verification" },
  { type: "guarantor_nrc", name: "Guarantor NRC", description: "Guarantor's National Registration Card" },
  { type: "collateral_docs", name: "Collateral Documents", description: "Documents for collateral assets" },
  { type: "insurance_cert", name: "Insurance Certificate", description: "PMIC insurance certificate" },
];

interface ProductDocumentManagerProps {
  productId: string;
  productName?: string;
}

interface DocForm {
  document_type: string;
  document_name: string;
  description: string;
  is_mandatory: boolean;
  max_file_size_mb: number;
  validity_days: string;
  can_reuse_previous: boolean;
}

const emptyForm: DocForm = {
  document_type: "",
  document_name: "",
  description: "",
  is_mandatory: true,
  max_file_size_mb: 10,
  validity_days: "",
  can_reuse_previous: false,
};

const ProductDocumentManager = ({ productId, productName }: ProductDocumentManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProductDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ProductDocument | null>(null);
  const [form, setForm] = useState<DocForm>(emptyForm);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["product-doc-requirements", productId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("product_document_requirements")
        .select("*")
        .eq("loan_product_id", productId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as ProductDocument[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: DocForm) => {
      const payload = {
        loan_product_id: productId,
        document_type: formData.document_type.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
        document_name: formData.document_name,
        description: formData.description || null,
        is_mandatory: formData.is_mandatory,
        max_file_size_mb: formData.max_file_size_mb,
        validity_days: formData.validity_days ? Number(formData.validity_days) : null,
        can_reuse_previous: formData.can_reuse_previous,
        display_order: editingDoc ? editingDoc.display_order : documents.length,
      };

      if (editingDoc) {
        const { error } = await (supabase.from as any)("product_document_requirements")
          .update(payload)
          .eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("product_document_requirements")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-doc-requirements", productId] });
      toast({ title: editingDoc ? "Document requirement updated" : "Document requirement added" });
      setIsDialogOpen(false);
      setEditingDoc(null);
      setForm(emptyForm);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("product_document_requirements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-doc-requirements", productId] });
      toast({ title: "Document requirement removed" });
      setDeleteDoc(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from as any)("product_document_requirements")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-doc-requirements", productId] });
    },
  });

  const openAdd = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (doc: ProductDocument) => {
    setEditingDoc(doc);
    setForm({
      document_type: doc.document_type,
      document_name: doc.document_name,
      description: doc.description || "",
      is_mandatory: doc.is_mandatory,
      max_file_size_mb: doc.max_file_size_mb,
      validity_days: doc.validity_days?.toString() || "",
      can_reuse_previous: doc.can_reuse_previous,
    });
    setIsDialogOpen(true);
  };

  const applyTemplate = (tpl: typeof COMMON_DOCUMENT_TYPES[0]) => {
    setForm({
      ...form,
      document_type: tpl.type,
      document_name: tpl.name,
      description: tpl.description,
    });
  };

  const mandatoryCount = documents.filter(d => d.is_mandatory && d.is_active).length;
  const optionalCount = documents.filter(d => !d.is_mandatory && d.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="text-primary" size={20} />
            Document Requirements
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure which documents borrowers must upload for {productName || "this product"}
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1">
          <Plus size={16} /> Add Requirement
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="outline" className="text-xs">
          <FileCheck size={12} className="mr-1" /> {mandatoryCount} Mandatory
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {optionalCount} Optional
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {documents.length} Total
        </Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No document requirements configured</p>
            <Button onClick={openAdd} variant="outline" size="sm">
              <Plus size={14} className="mr-1" /> Add First Requirement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Type Key</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Max Size</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc, idx) => (
                <TableRow key={doc.id} className={!doc.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <GripVertical size={14} className="text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{doc.document_name}</p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground">{doc.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{doc.document_type}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={doc.is_mandatory ? "default" : "secondary"} className="text-xs">
                      {doc.is_mandatory ? "Required" : "Optional"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{doc.max_file_size_mb}MB</TableCell>
                  <TableCell>
                    <Switch
                      checked={doc.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: doc.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteDoc(doc)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit" : "Add"} Document Requirement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quick template select */}
            {!editingDoc && (
              <div className="space-y-2">
                <Label>Quick Add from Template</Label>
                <Select
                  onValueChange={(val) => {
                    const tpl = COMMON_DOCUMENT_TYPES.find(t => t.type === val);
                    if (tpl) applyTemplate(tpl);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a common document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_DOCUMENT_TYPES.map((tpl) => (
                      <SelectItem key={tpl.type} value={tpl.type}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input
                  value={form.document_name}
                  onChange={(e) => setForm({ ...form, document_name: e.target.value })}
                  placeholder="e.g. NRC (Front)"
                />
              </div>
              <div className="space-y-2">
                <Label>Type Key *</Label>
                <Input
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  placeholder="e.g. nrc_front"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of document"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max File Size (MB)</Label>
                <Input
                  type="number"
                  value={form.max_file_size_mb}
                  onChange={(e) => setForm({ ...form, max_file_size_mb: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Validity (Days)</Label>
                <Input
                  type="number"
                  value={form.validity_days}
                  onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
                  placeholder="Leave empty for no expiry"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label className="font-medium">Mandatory</Label>
                <p className="text-xs text-muted-foreground">Borrower must upload this document</p>
              </div>
              <Switch
                checked={form.is_mandatory}
                onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label className="font-medium">Allow Reuse</Label>
                <p className="text-xs text-muted-foreground">Can reuse document from a previous loan</p>
              </div>
              <Switch
                checked={form.can_reuse_previous}
                onCheckedChange={(v) => setForm({ ...form, can_reuse_previous: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.document_name || !form.document_type || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDoc ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document Requirement</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteDoc?.document_name}" from the required documents? This won't delete any already-uploaded files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductDocumentManager;
