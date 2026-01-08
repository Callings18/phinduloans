import { useState } from "react";
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
    FileCheck,
    FileX,
    Loader2,
    Upload,
    Clock,
    RefreshCw,
    Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types - placeholder until migration is run
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

    // Placeholder state - actual implementation requires database migration
    const [documents] = useState<ProductDocument[]>([]);
    const isLoading = false;

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
            </div>

            {/* Info Banner */}
            <Card className="bg-muted/30 border-muted">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Info className="text-muted-foreground mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-medium">Feature Coming Soon</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Document requirements configuration will be available after the database migration is completed. 
                                Currently, documents are managed through the loan application flow using the product's requirements field.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Reference */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileCheck size={18} className="text-primary" />
                        Common Document Types
                    </CardTitle>
                    <CardDescription>
                        Reference list of common document types used in loan applications
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {COMMON_DOCUMENT_TYPES.map((template) => (
                            <Badge
                                key={template.type}
                                variant="outline"
                                className="text-xs"
                            >
                                {template.name}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProductDocumentManager;
