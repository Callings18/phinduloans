import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
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
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Eye,
  Save,
  Loader2,
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  placeholders: string[];
  is_active: boolean;
  loan_product_id: string | null;
  created_at: string;
  updated_at: string;
  file_url?: string | null;
  file_type?: "text" | "docx";
}

const DEFAULT_PLACEHOLDERS = [
  { key: "{{borrower_name}}", description: "Full name of the borrower" },
  { key: "{{borrower_address}}", description: "Borrower's address" },
  { key: "{{borrower_nrc}}", description: "Borrower's NRC number" },
  { key: "{{borrower_phone}}", description: "Borrower's phone number" },
  { key: "{{borrower_email}}", description: "Borrower's email address" },
  { key: "{{loan_amount}}", description: "Principal loan amount" },
  { key: "{{loan_term}}", description: "Loan term in months" },
  { key: "{{interest_rate}}", description: "Interest rate percentage" },
  { key: "{{monthly_payment}}", description: "Monthly installment amount" },
  { key: "{{total_repayment}}", description: "Total amount to be repaid" },
  { key: "{{disbursement_date}}", description: "Date of loan disbursement" },
  { key: "{{first_payment_date}}", description: "First repayment due date" },
  { key: "{{company_name}}", description: "Lending company name" },
  { key: "{{company_address}}", description: "Company address" },
  { key: "{{current_date}}", description: "Today's date" },
  { key: "{{loan_purpose}}", description: "Purpose of the loan" },
  { key: "{{processing_fee}}", description: "Processing fee amount" },
  { key: "{{late_penalty}}", description: "Late payment penalty rate" },
];

const DEFAULT_TEMPLATE = `LOAN AGREEMENT

This Loan Agreement ("Agreement") is entered into as of {{current_date}}

BETWEEN:

{{company_name}}
{{company_address}}
(hereinafter referred to as the "Lender")

AND:

{{borrower_name}}
{{borrower_address}}
NRC: {{borrower_nrc}}
Phone: {{borrower_phone}}
Email: {{borrower_email}}
(hereinafter referred to as the "Borrower")

1. LOAN DETAILS
Principal Amount: K{{loan_amount}}
Interest Rate: {{interest_rate}}% per month
Loan Term: {{loan_term}} months
Monthly Payment: K{{monthly_payment}}
Total Repayment: K{{total_repayment}}
Purpose: {{loan_purpose}}

2. DISBURSEMENT
The Lender agrees to disburse the loan amount on {{disbursement_date}}.

3. REPAYMENT
The Borrower agrees to repay the loan in {{loan_term}} equal monthly installments of K{{monthly_payment}}, 
with the first payment due on {{first_payment_date}}.

4. LATE PAYMENT
A penalty of {{late_penalty}}% will be charged on the principal loan amount for any overdue installments.

5. PROCESSING FEE
A processing fee of K{{processing_fee}} has been deducted from the disbursement.

6. SIGNATURES

_______________________          _______________________
Borrower Signature               Lender Representative
Date: _______________           Date: _______________
`;

const AdminContractTemplates = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: DEFAULT_TEMPLATE,
    loan_product_id: "",
    is_active: true,
    file_type: "text" as "text" | "docx",
    file_url: "",
  });
  const [docxFile, setDocxFile] = useState<File | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates from system_settings
  const { data: templates, isLoading } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'contract_templates')
        .maybeSingle();

      if (error) throw error;
      
      // Parse stored templates or return empty array
      const storedTemplates = data?.value as unknown as ContractTemplate[] | null;
      return storedTemplates || [];
    },
  });

  // Fetch loan products for linking
  const { data: loanProducts } = useQuery({
    queryKey: ['loan-products-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('id, name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Extract placeholders from content
  const extractPlaceholders = (content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches)];
  };

  // Save templates mutation
  const saveMutation = useMutation({
    mutationFn: async (updatedTemplates: ContractTemplate[]) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'contract_templates',
          value: updatedTemplates as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
    },
  });

  // Upload DOCX file
  const uploadDocxFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `contract-templates/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({ title: "Failed to upload file", description: uploadError.message, variant: "destructive" });
      return null;
    }

    return fileName;
  };

  // Create template
  const handleCreate = async () => {
    if (!formData.name || (!formData.content && !docxFile)) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    let fileUrl = formData.file_url;
    
    // Upload DOCX file if provided
    if (docxFile && formData.file_type === 'docx') {
      const uploadedUrl = await uploadDocxFile(docxFile);
      if (!uploadedUrl) return; // Error already shown in uploadDocxFile
      fileUrl = uploadedUrl;
    }

    const newTemplate: ContractTemplate = {
      id: crypto.randomUUID(),
      name: formData.name,
      description: formData.description || null,
      content: formData.content || '', // Empty if using DOCX
      placeholders: formData.file_type === 'text' ? extractPlaceholders(formData.content) : [],
      is_active: formData.is_active,
      loan_product_id: formData.loan_product_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_url: fileUrl || null,
      file_type: formData.file_type,
    };

    const updatedTemplates = [...(templates || []), newTemplate];
    
    saveMutation.mutate(updatedTemplates, {
      onSuccess: () => {
        toast({ title: "Template created successfully" });
        setIsAddOpen(false);
        resetForm();
      },
      onError: (error: any) => {
        toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
      },
    });
  };

  // Update template
  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name || (!formData.content && !docxFile && formData.file_type === 'text')) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    let fileUrl = formData.file_url;
    
    // Upload new DOCX file if provided
    if (docxFile && formData.file_type === 'docx') {
      const uploadedUrl = await uploadDocxFile(docxFile);
      if (!uploadedUrl) return; // Error already shown
      fileUrl = uploadedUrl;
    }

    const updatedTemplates = (templates || []).map(t => 
      t.id === selectedTemplate.id 
        ? {
            ...t,
            name: formData.name,
            description: formData.description || null,
            content: formData.content || '',
            placeholders: formData.file_type === 'text' ? extractPlaceholders(formData.content) : [],
            is_active: formData.is_active,
            loan_product_id: formData.loan_product_id || null,
            updated_at: new Date().toISOString(),
            file_url: fileUrl || t.file_url || null,
            file_type: formData.file_type,
          }
        : t
    );

    saveMutation.mutate(updatedTemplates, {
      onSuccess: () => {
        toast({ title: "Template updated successfully" });
        setIsEditOpen(false);
        setSelectedTemplate(null);
        resetForm();
      },
      onError: (error: any) => {
        toast({ title: "Failed to update template", description: error.message, variant: "destructive" });
      },
    });
  };

  // Delete template
  const handleDelete = () => {
    if (!selectedTemplate) return;

    const updatedTemplates = (templates || []).filter(t => t.id !== selectedTemplate.id);

    saveMutation.mutate(updatedTemplates, {
      onSuccess: () => {
        toast({ title: "Template deleted successfully" });
        setIsDeleteOpen(false);
        setSelectedTemplate(null);
      },
      onError: (error: any) => {
        toast({ title: "Failed to delete template", description: error.message, variant: "destructive" });
      },
    });
  };

  // Clone template
  const handleClone = (template: ContractTemplate) => {
    const clonedTemplate: ContractTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Copy)`,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedTemplates = [...(templates || []), clonedTemplate];

    saveMutation.mutate(updatedTemplates, {
      onSuccess: () => {
        toast({ title: "Template cloned successfully" });
      },
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      content: DEFAULT_TEMPLATE,
      loan_product_id: "",
      is_active: true,
      file_type: "text",
      file_url: "",
    });
    setDocxFile(null);
  };

  const openEditDialog = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      content: template.content,
      loan_product_id: template.loan_product_id || "",
      is_active: template.is_active,
      file_type: (template as any).file_type || "text",
      file_url: (template as any).file_url || "",
    });
    setDocxFile(null);
    setIsEditOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Contract Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage loan agreement templates with dynamic placeholders
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 gradient-primary">
            <Plus size={16} />
            New Template
          </Button>
        </div>

        {/* Placeholders Reference */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info size={18} />
              Available Placeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_PLACEHOLDERS.map(p => (
                <Badge 
                  key={p.key} 
                  variant="outline" 
                  className="cursor-help"
                  title={p.description}
                >
                  {p.key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>{template.placeholders.length} placeholders</p>
                    {template.loan_product_id && (
                      <p>Linked to: {loanProducts?.find(p => p.id === template.loan_product_id)?.name || 'Unknown'}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye size={14} className="mr-1" />
                      Preview
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleClone(template)}
                    >
                      <Copy size={14} className="mr-1" />
                      Clone
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No contract templates yet</p>
              <Button onClick={() => setIsAddOpen(true)} className="mt-4">
                Create First Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setIsEditOpen(false);
          setSelectedTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? "Edit Template" : "Create New Template"}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? "Update your contract template" : "Define a reusable contract template with placeholders"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="content" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g., Standard Loan Agreement"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description of this template"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Template Type Selection */}
              <div className="space-y-2">
                <Label>Template Type *</Label>
                <Select 
                  value={formData.file_type} 
                  onValueChange={(v) => setFormData({ ...formData, file_type: v as "text" | "docx" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Template (Plain Text)</SelectItem>
                    <SelectItem value="docx">DOCX File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.file_type === 'text' ? (
                <div className="space-y-2">
                  <Label>Contract Content *</Label>
                  <Textarea
                    placeholder="Enter contract text with placeholders like {{borrower_name}}"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={20}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use placeholders like {"{{borrower_name}}"} for dynamic content
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Upload DOCX Template *</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <Input
                      type="file"
                      accept=".docx,.doc"
                      onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {docxFile && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {docxFile.name}
                      </p>
                    )}
                    {formData.file_url && !docxFile && (
                      <p className="text-sm text-success mt-2">
                        Current file: {formData.file_url.split('/').pop()}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload your existing DOCX contract template. Placeholders like {"{{borrower_name}}"} will be replaced with actual loan data.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-2">
                <Label>Link to Loan Product (Optional)</Label>
                <Select 
                  value={formData.loan_product_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, loan_product_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific product</SelectItem>
                    {loanProducts?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_active">Active (available for use)</Label>
              </div>

              <div className="p-4 rounded-xl bg-secondary/30">
                <h4 className="font-semibold mb-2">Detected Placeholders</h4>
                <div className="flex flex-wrap gap-2">
                  {extractPlaceholders(formData.content).map(p => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddOpen(false);
              setIsEditOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={saveMutation.isPending}
              className="gradient-primary"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {isEditOpen ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>Template Preview</DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 font-mono text-sm whitespace-pre-wrap">
            {selectedTemplate?.content}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminContractTemplates;
