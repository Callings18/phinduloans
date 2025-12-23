import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  Percent,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  AlertTriangle,
  Settings,
  Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_type: string;
  processing_fee_percent: number | null;
  is_active: boolean;
  employment_types: string[] | null;
  requirements: string[] | null;
  grace_period_days: number;
  late_payment_penalty_percent: number;
  early_repayment_allowed: boolean;
  early_repayment_fee_percent: number;
  insurance_required: boolean;
  insurance_percent: number;
  collateral_required: boolean;
  max_dti_ratio: number;
  min_credit_score: number;
  created_at: string;
}

const AdminLoanProducts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    min_amount: 500,
    max_amount: 50000,
    min_term_months: 1,
    max_term_months: 24,
    interest_rate: 15,
    interest_type: "flat",
    processing_fee_percent: 2,
    is_active: true,
    requirements: "",
    employment_types: ["employed", "self_employed", "contract"],
    grace_period_days: 0,
    late_payment_penalty_percent: 0,
    early_repayment_allowed: true,
    early_repayment_fee_percent: 0,
    insurance_required: false,
    insurance_percent: 0,
    collateral_required: false,
    max_dti_ratio: 50,
    min_credit_score: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("loan_products").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Loan product created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LoanProduct> }) => {
      const { error } = await supabase.from("loan_products").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Loan product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Loan product deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      min_amount: 500,
      max_amount: 50000,
      min_term_months: 1,
      max_term_months: 24,
      interest_rate: 15,
      interest_type: "flat",
      processing_fee_percent: 2,
      is_active: true,
      requirements: "",
      employment_types: ["employed", "self_employed", "contract"],
      grace_period_days: 0,
      late_payment_penalty_percent: 0,
      early_repayment_allowed: true,
      early_repayment_fee_percent: 0,
      insurance_required: false,
      insurance_percent: 0,
      collateral_required: false,
      max_dti_ratio: 50,
      min_credit_score: 0,
    });
  };

  const handleEdit = (product: LoanProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      min_amount: product.min_amount,
      max_amount: product.max_amount,
      min_term_months: product.min_term_months,
      max_term_months: product.max_term_months,
      interest_rate: product.interest_rate,
      interest_type: product.interest_type || "flat",
      processing_fee_percent: product.processing_fee_percent || 2,
      is_active: product.is_active,
      requirements: product.requirements?.join("\n") || "",
      employment_types: product.employment_types || ["employed", "self_employed", "contract"],
      grace_period_days: product.grace_period_days || 0,
      late_payment_penalty_percent: product.late_payment_penalty_percent || 0,
      early_repayment_allowed: product.early_repayment_allowed ?? true,
      early_repayment_fee_percent: product.early_repayment_fee_percent || 0,
      insurance_required: product.insurance_required || false,
      insurance_percent: product.insurance_percent || 0,
      collateral_required: product.collateral_required || false,
      max_dti_ratio: product.max_dti_ratio || 50,
      min_credit_score: product.min_credit_score || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const productData = {
      name: formData.name,
      description: formData.description || null,
      min_amount: formData.min_amount,
      max_amount: formData.max_amount,
      min_term_months: formData.min_term_months,
      max_term_months: formData.max_term_months,
      interest_rate: formData.interest_rate,
      interest_type: formData.interest_type,
      processing_fee_percent: formData.processing_fee_percent,
      is_active: formData.is_active,
      requirements: formData.requirements.split("\n").filter(r => r.trim()),
      employment_types: formData.employment_types,
      grace_period_days: formData.grace_period_days,
      late_payment_penalty_percent: formData.late_payment_penalty_percent,
      early_repayment_allowed: formData.early_repayment_allowed,
      early_repayment_fee_percent: formData.early_repayment_fee_percent,
      insurance_required: formData.insurance_required,
      insurance_percent: formData.insurance_percent,
      collateral_required: formData.collateral_required,
      max_dti_ratio: formData.max_dti_ratio,
      min_credit_score: formData.min_credit_score,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const toggleActive = (product: LoanProduct) => {
    updateMutation.mutate({
      id: product.id,
      data: { is_active: !product.is_active },
    });
  };

  const toggleEmploymentType = (type: string) => {
    const current = formData.employment_types;
    if (current.includes(type)) {
      setFormData({ ...formData, employment_types: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, employment_types: [...current, type] });
    }
  };

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: products?.length || 0,
    active: products?.filter((p) => p.is_active).length || 0,
    inactive: products?.filter((p) => !p.is_active).length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Loan Products</h1>
            <p className="text-muted-foreground">Manage your loan product offerings with advanced configurations</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus size={18} className="mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Loan Product" : "Create Loan Product"}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">
                    <Package size={14} className="mr-2" />
                    Basic
                  </TabsTrigger>
                  <TabsTrigger value="interest">
                    <Calculator size={14} className="mr-2" />
                    Interest & Fees
                  </TabsTrigger>
                  <TabsTrigger value="risk">
                    <Shield size={14} className="mr-2" />
                    Risk Controls
                  </TabsTrigger>
                  <TabsTrigger value="requirements">
                    <Settings size={14} className="mr-2" />
                    Requirements
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>Product Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Personal Loan, Salary Advance"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of the loan product"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Amount (K)</Label>
                      <Input
                        type="number"
                        value={formData.min_amount}
                        onChange={(e) => setFormData({ ...formData, min_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Amount (K)</Label>
                      <Input
                        type="number"
                        value={formData.max_amount}
                        onChange={(e) => setFormData({ ...formData, max_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Term (months)</Label>
                      <Input
                        type="number"
                        value={formData.min_term_months}
                        onChange={(e) => setFormData({ ...formData, min_term_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Term (months)</Label>
                      <Input
                        type="number"
                        value={formData.max_term_months}
                        onChange={(e) => setFormData({ ...formData, max_term_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label>Active (visible to borrowers)</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="interest" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Interest Type</Label>
                      <Select
                        value={formData.interest_type}
                        onValueChange={(v) => setFormData({ ...formData, interest_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Rate</SelectItem>
                          <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                          <SelectItem value="compound">Compound</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.interest_type === "flat" && "Interest calculated on original principal"}
                        {formData.interest_type === "reducing_balance" && "Interest calculated on outstanding balance"}
                        {formData.interest_type === "compound" && "Interest calculated on principal + accrued interest"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Rate (% per month)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.interest_rate}
                        onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Processing Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.processing_fee_percent}
                        onChange={(e) => setFormData({ ...formData, processing_fee_percent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grace Period (days)</Label>
                      <Input
                        type="number"
                        value={formData.grace_period_days}
                        onChange={(e) => setFormData({ ...formData, grace_period_days: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Days after due date before late fees apply</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Late Payment Penalty (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.late_payment_penalty_percent}
                        onChange={(e) => setFormData({ ...formData, late_payment_penalty_percent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Early Repayment Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.early_repayment_fee_percent}
                        onChange={(e) => setFormData({ ...formData, early_repayment_fee_percent: Number(e.target.value) })}
                        disabled={!formData.early_repayment_allowed}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <Switch
                        checked={formData.early_repayment_allowed}
                        onCheckedChange={(checked) => setFormData({ ...formData, early_repayment_allowed: checked })}
                      />
                      <Label>Allow Early Repayment</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Maximum DTI Ratio (%)</Label>
                      <Input
                        type="number"
                        value={formData.max_dti_ratio}
                        onChange={(e) => setFormData({ ...formData, max_dti_ratio: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Max debt-to-income ratio allowed</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Credit Score</Label>
                      <Input
                        type="number"
                        value={formData.min_credit_score}
                        onChange={(e) => setFormData({ ...formData, min_credit_score: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">0 = no minimum requirement</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Premium (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.insurance_percent}
                        onChange={(e) => setFormData({ ...formData, insurance_percent: Number(e.target.value) })}
                        disabled={!formData.insurance_required}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={formData.collateral_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, collateral_required: checked })}
                        />
                        <Label>Collateral Required</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={formData.insurance_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, insurance_required: checked })}
                        />
                        <Label>Insurance Required</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="requirements" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Eligible Employment Types</Label>
                      <div className="flex flex-wrap gap-2">
                        {["employed", "self_employed", "contract", "other"].map((type) => (
                          <Badge
                            key={type}
                            variant={formData.employment_types.includes(type) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => toggleEmploymentType(type)}
                          >
                            {type.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Document Requirements (one per line)</Label>
                      <Textarea
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        placeholder="Valid NRC (front & back)&#10;Latest payslip&#10;3 months bank statement&#10;Proof of residence"
                        rows={6}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gradient-primary"
                  onClick={handleSubmit}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                >
                  {editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl gradient-primary">
                  <Package className="text-primary-foreground" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle className="text-success" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted">
                  <XCircle className="text-muted-foreground" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Table */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>Configure loan types available to borrowers</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount Range</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign size={14} className="text-muted-foreground" />
                          K{product.min_amount.toLocaleString()} - K{product.max_amount.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock size={14} className="text-muted-foreground" />
                          {product.min_term_months} - {product.max_term_months} mo
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Percent size={14} className="text-muted-foreground" />
                            {product.interest_rate}% <span className="text-xs text-muted-foreground">({product.interest_type || "flat"})</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {product.collateral_required && (
                            <Badge variant="outline" className="text-xs">Collateral</Badge>
                          )}
                          {product.insurance_required && (
                            <Badge variant="outline" className="text-xs">Insurance</Badge>
                          )}
                          {product.grace_period_days > 0 && (
                            <Badge variant="outline" className="text-xs">{product.grace_period_days}d Grace</Badge>
                          )}
                          {product.late_payment_penalty_percent > 0 && (
                            <Badge variant="outline" className="text-xs text-destructive">{product.late_payment_penalty_percent}% Penalty</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.is_active ? "default" : "secondary"}
                          className={product.is_active ? "bg-success/10 text-success border-success/20" : ""}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={product.is_active}
                            onCheckedChange={() => toggleActive(product)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(product.id)}
                          >
                            <Trash2 size={16} />
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
      </div>
    </AdminLayout>
  );
};

export default AdminLoanProducts;