import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    FileText,
    Plus,
    Pencil,
    Trash2,
    GripVertical,
    FileCheck,
    FileX,
    Loader2,
    Upload,
    Clock,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types
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

// Default document types for quick add
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

const ProductDocumentManager = ({ productId, productName }: ProductDocumentManagerProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ProductDocument | null>(null);
    const [deleteDoc, setDeleteDoc] = useState<ProductDocument | null>(null);
    const [formData, setFormData] = useState({
        document_type: "",
        document_name: "",
        description: "",
        is_mandatory: true,
        allowed_file_types: ["pdf", "jpg", "jpeg", "png"],
        max_file_size_mb: 5,
        validity_days: null as number | null,
        can_reuse_previous: false,
        display_order: 0,
        is_active: true,
    });

    // Fetch documents for this product
    const { data: documents, isLoading } = useQuery({
        queryKey: ["product-documents", productId],
        queryFn: async () => {
            // @ts-expect-error - Table exists after running migrations
            const { data, error } = await supabase
                .from("loan_product_documents")
                .select("*")
                .eq("loan_product_id", productId)
                .order("display_order", { ascending: true });

            if (error) throw error;
            return data as unknown as ProductDocument[];
        },
        enabled: !!productId,
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: Omit<ProductDocument, "id" | "created_at">) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("loan_product_documents")
                .insert({ ...data, loan_product_id: productId });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-documents", productId] });
            toast({ title: "Document requirement added" });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ProductDocument> }) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("loan_product_documents")
                .update(data)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-documents", productId] });
            toast({ title: "Document requirement updated" });
            setIsDialogOpen(false);
            setEditingDoc(null);
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("loan_product_documents")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product-documents", productId] });
            toast({ title: "Document requirement removed" });
            setDeleteDoc(null);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const resetForm = () => {
        setFormData({
            document_type: "",
            document_name: "",
            description: "",
            is_mandatory: true,
            allowed_file_types: ["pdf", "jpg", "jpeg", "png"],
            max_file_size_mb: 5,
            validity_days: null,
            can_reuse_previous: false,
            display_order: (documents?.length || 0) + 1,
            is_active: true,
        });
    };

    const handleEdit = (doc: ProductDocument) => {
        setEditingDoc(doc);
        setFormData({
            document_type: doc.document_type,
            document_name: doc.document_name,
            description: doc.description || "",
            is_mandatory: doc.is_mandatory,
            allowed_file_types: doc.allowed_file_types,
            max_file_size_mb: doc.max_file_size_mb,
            validity_days: doc.validity_days,
            can_reuse_previous: doc.can_reuse_previous,
            display_order: doc.display_order,
            is_active: doc.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleQuickAdd = (template: typeof COMMON_DOCUMENT_TYPES[0]) => {
        setFormData({
            ...formData,
            document_type: template.type,
            document_name: template.name,
            description: template.description,
            display_order: (documents?.length || 0) + 1,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        if (!formData.document_type || !formData.document_name) {
            toast({ title: "Please fill in required fields", variant: "destructive" });
            return;
        }

        if (editingDoc) {
            updateMutation.mutate({ id: editingDoc.id, data: formData as any });
        } else {
            createMutation.mutate(formData as any);
        }
    };

    const toggleFileType = (type: string) => {
        const current = formData.allowed_file_types;
        if (current.includes(type)) {
            setFormData({ ...formData, allowed_file_types: current.filter(t => t !== type) });
        } else {
            setFormData({ ...formData, allowed_file_types: [...current, type] });
        }
    };

    const mandatoryCount = documents?.filter(d => d.is_mandatory && d.is_active).length || 0;
    const optionalCount = documents?.filter(d => !d.is_mandatory && d.is_active).length || 0;

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
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingDoc(null);
                        resetForm();
                    }
                }}>
                    <Button onClick={() => setIsDialogOpen(true)} size="sm">
                        <Plus size={16} className="mr-2" />
                        Add Document
                    </Button>

                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {editingDoc ? "Edit Document Requirement" : "Add Document Requirement"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Quick Add Templates */}
                            {!editingDoc && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Quick Add Common Documents</Label>
                                    <div className="flex flex-wrap gap-1">
                                        {COMMON_DOCUMENT_TYPES.slice(0, 8).map((template) => (
                                            <Badge
                                                key={template.type}
                                                variant="outline"
                                                className="cursor-pointer hover:bg-primary/10 text-xs"
                                                onClick={() => handleQuickAdd(template)}
                                            >
                                                {template.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Document Type *</Label>
                                    <Input
                                        value={formData.document_type}
                                        onChange={(e) => setFormData({ ...formData, document_type: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                        placeholder="e.g., nrc_front"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Display Name *</Label>
                                    <Input
                                        value={formData.document_name}
                                        onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                                        placeholder="e.g., NRC (Front)"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Instructions for the borrower"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Max File Size (MB)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_file_size_mb}
                                        onChange={(e) => setFormData({ ...formData, max_file_size_mb: Number(e.target.value) })}
                                        min={1}
                                        max={50}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Validity (days)</Label>
                                    <Input
                                        type="number"
                                        value={formData.validity_days || ""}
                                        onChange={(e) => setFormData({ ...formData, validity_days: e.target.value ? Number(e.target.value) : null })}
                                        placeholder="No expiry"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Allowed File Types</Label>
                                <div className="flex flex-wrap gap-2">
                                    {["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"].map((type) => (
                                        <Badge
                                            key={type}
                                            variant={formData.allowed_file_types.includes(type) ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => toggleFileType(type)}
                                        >
                                            .{type}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileCheck size={16} className="text-primary" />
                                        <Label>Mandatory Document</Label>
                                    </div>
                                    <Switch
                                        checked={formData.is_mandatory}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw size={16} className="text-primary" />
                                        <Label>Can Reuse From Previous Loans</Label>
                                    </div>
                                    <Switch
                                        checked={formData.can_reuse_previous}
                                        onCheckedChange={(checked) => setFormData({ ...formData, can_reuse_previous: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileX size={16} className="text-muted-foreground" />
                                        <Label>Active</Label>
                                    </div>
                                    <Switch
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {editingDoc ? "Update" : "Add Document"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-border/50">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <FileText className="text-primary" size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{documents?.length || 0}</p>
                            <p className="text-xs text-muted-foreground">Total Documents</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/50">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                            <FileCheck className="text-destructive" size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{mandatoryCount}</p>
                            <p className="text-xs text-muted-foreground">Mandatory</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/50">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Upload className="text-muted-foreground" size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{optionalCount}</p>
                            <p className="text-xs text-muted-foreground">Optional</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Documents Table */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configured Documents</CardTitle>
                    <CardDescription>
                        Drag to reorder. Mandatory documents are required before submission.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : documents?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="mx-auto h-10 w-10 mb-2 opacity-50" />
                            <p>No document requirements configured</p>
                            <p className="text-sm">Add documents that borrowers must upload</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Document</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Required</TableHead>
                                    <TableHead>File Types</TableHead>
                                    <TableHead>Max Size</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents?.map((doc) => (
                                    <TableRow key={doc.id} className={!doc.is_active ? "opacity-50" : ""}>
                                        <TableCell>
                                            <GripVertical className="text-muted-foreground cursor-grab" size={16} />
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{doc.document_name}</p>
                                                {doc.description && (
                                                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {doc.document_type}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            {doc.is_mandatory ? (
                                                <Badge variant="destructive" className="text-xs">Required</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">Optional</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {doc.allowed_file_types.slice(0, 3).map((type) => (
                                                    <Badge key={type} variant="secondary" className="text-xs px-1.5">
                                                        .{type}
                                                    </Badge>
                                                ))}
                                                {doc.allowed_file_types.length > 3 && (
                                                    <Badge variant="secondary" className="text-xs px-1.5">
                                                        +{doc.allowed_file_types.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{doc.max_file_size_mb}MB</TableCell>
                                        <TableCell>
                                            {doc.is_active ? (
                                                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(doc)}
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteDoc(doc)}
                                                >
                                                    <Trash2 size={14} className="text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Document Requirement?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove "{deleteDoc?.document_name}" from the required documents for this product.
                            Existing loan applications will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
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
