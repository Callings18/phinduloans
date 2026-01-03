import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
    GitBranch,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    ArrowRight,
    CheckCircle,
    XCircle,
    Clock,
    FileSearch,
    Shield,
    Eye,
    Banknote,
    Activity,
    Trophy,
    AlertTriangle,
    FileEdit,
    Send,
    Zap,
    Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types
export interface WorkflowStage {
    id: string;
    loan_product_id: string | null;
    stage_code: string;
    stage_name: string;
    stage_description: string | null;
    stage_order: number;
    stage_type: "manual" | "automatic" | "conditional";
    color: string;
    icon: string | null;
    is_initial: boolean;
    is_terminal: boolean;
    is_active: boolean;
    created_at: string;
}

export interface WorkflowTransition {
    id: string;
    loan_product_id: string | null;
    from_stage_id: string;
    to_stage_id: string;
    transition_name: string;
    transition_action: string | null;
    required_role: string[] | null;
    requires_comment: boolean;
    requires_document: boolean;
    notification_template: string | null;
    is_active: boolean;
}

// Icon mapping
const STAGE_ICONS: Record<string, React.ComponentType<any>> = {
    FileEdit,
    Send,
    FileSearch,
    Shield,
    Eye,
    CheckCircle,
    Banknote,
    Activity,
    Trophy,
    XCircle,
    AlertTriangle,
    Clock,
};

// Default stages template
const DEFAULT_STAGES = [
    { code: "draft", name: "Draft", description: "Application started but not submitted", type: "manual", color: "#6b7280", icon: "FileEdit", isInitial: true },
    { code: "submitted", name: "Submitted", description: "Application submitted for review", type: "manual", color: "#3b82f6", icon: "Send" },
    { code: "document_review", name: "Document Review", description: "Verifying uploaded documents", type: "manual", color: "#8b5cf6", icon: "FileSearch" },
    { code: "crb_check", name: "CRB Check", description: "Credit bureau verification", type: "automatic", color: "#f59e0b", icon: "Shield" },
    { code: "under_review", name: "Under Review", description: "Loan officer reviewing application", type: "manual", color: "#06b6d4", icon: "Eye" },
    { code: "approved", name: "Approved", description: "Loan approved, pending disbursement", type: "manual", color: "#10b981", icon: "CheckCircle" },
    { code: "disbursed", name: "Disbursed", description: "Funds sent to borrower", type: "manual", color: "#22c55e", icon: "Banknote" },
    { code: "active", name: "Active", description: "Loan is active with ongoing repayments", type: "automatic", color: "#14b8a6", icon: "Activity" },
    { code: "completed", name: "Completed", description: "Loan fully repaid", type: "automatic", color: "#10b981", icon: "Trophy", isTerminal: true },
    { code: "rejected", name: "Rejected", description: "Application rejected", type: "manual", color: "#ef4444", icon: "XCircle", isTerminal: true },
    { code: "defaulted", name: "Defaulted", description: "Loan in default status", type: "automatic", color: "#dc2626", icon: "AlertTriangle", isTerminal: true },
];

interface WorkflowConfigurationProps {
    productId: string;
    productName?: string;
}

const WorkflowConfiguration = ({ productId, productName }: WorkflowConfigurationProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
    const [isTransitionDialogOpen, setIsTransitionDialogOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
    const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);
    const [deleteStage, setDeleteStage] = useState<WorkflowStage | null>(null);

    const [stageForm, setStageForm] = useState({
        stage_code: "",
        stage_name: "",
        stage_description: "",
        stage_order: 0,
        stage_type: "manual" as "manual" | "automatic" | "conditional",
        color: "#3b82f6",
        icon: "CheckCircle",
        is_initial: false,
        is_terminal: false,
        is_active: true,
    });

    const [transitionForm, setTransitionForm] = useState({
        from_stage_id: "",
        to_stage_id: "",
        transition_name: "",
        transition_action: "",
        required_role: [] as string[],
        requires_comment: false,
        requires_document: false,
        notification_template: "",
        is_active: true,
    });

    // Fetch workflow stages
    const { data: stages, isLoading: stagesLoading } = useQuery({
        queryKey: ["workflow-stages", productId],
        queryFn: async () => {
            // @ts-expect-error - Table exists after running migrations
            const { data, error } = await supabase
                .from("workflow_stages")
                .select("*")
                .eq("loan_product_id", productId)
                .order("stage_order", { ascending: true });

            if (error) throw error;
            return data as unknown as WorkflowStage[];
        },
        enabled: !!productId,
    });

    // Fetch workflow transitions
    const { data: transitions, isLoading: transitionsLoading } = useQuery({
        queryKey: ["workflow-transitions", productId],
        queryFn: async () => {
            // @ts-expect-error - Table exists after running migrations
            const { data, error } = await supabase
                .from("workflow_transitions")
                .select("*")
                .eq("loan_product_id", productId);

            if (error) throw error;
            return data as unknown as WorkflowTransition[];
        },
        enabled: !!productId,
    });

    // Create stage mutation
    const createStageMutation = useMutation({
        mutationFn: async (data: Omit<WorkflowStage, "id" | "created_at">) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("workflow_stages")
                .insert({ ...data, loan_product_id: productId });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflow-stages", productId] });
            toast({ title: "Stage created successfully" });
            setIsStageDialogOpen(false);
            resetStageForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Update stage mutation
    const updateStageMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<WorkflowStage> }) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("workflow_stages")
                .update(data)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflow-stages", productId] });
            toast({ title: "Stage updated successfully" });
            setIsStageDialogOpen(false);
            setEditingStage(null);
            resetStageForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Delete stage mutation
    const deleteStageMutation = useMutation({
        mutationFn: async (id: string) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("workflow_stages")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflow-stages", productId] });
            toast({ title: "Stage deleted" });
            setDeleteStage(null);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Create default workflow mutation
    const createDefaultWorkflowMutation = useMutation({
        mutationFn: async () => {
            // Insert all default stages
            const stagesToInsert = DEFAULT_STAGES.map((stage, index) => ({
                loan_product_id: productId,
                stage_code: stage.code,
                stage_name: stage.name,
                stage_description: stage.description,
                stage_order: index,
                stage_type: stage.type,
                color: stage.color,
                icon: stage.icon,
                is_initial: stage.isInitial || false,
                is_terminal: stage.isTerminal || false,
                is_active: true,
            }));

            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("workflow_stages")
                .insert(stagesToInsert);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflow-stages", productId] });
            toast({ title: "Default workflow created", description: "11 stages added to this product" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Create transition mutation
    const createTransitionMutation = useMutation({
        mutationFn: async (data: Omit<WorkflowTransition, "id">) => {
            // @ts-expect-error - Table exists after running migrations
            const { error } = await supabase
                .from("workflow_transitions")
                .insert({ ...data, loan_product_id: productId });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workflow-transitions", productId] });
            toast({ title: "Transition created successfully" });
            setIsTransitionDialogOpen(false);
            resetTransitionForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const resetStageForm = () => {
        setStageForm({
            stage_code: "",
            stage_name: "",
            stage_description: "",
            stage_order: (stages?.length || 0),
            stage_type: "manual",
            color: "#3b82f6",
            icon: "CheckCircle",
            is_initial: false,
            is_terminal: false,
            is_active: true,
        });
    };

    const resetTransitionForm = () => {
        setTransitionForm({
            from_stage_id: "",
            to_stage_id: "",
            transition_name: "",
            transition_action: "",
            required_role: [],
            requires_comment: false,
            requires_document: false,
            notification_template: "",
            is_active: true,
        });
    };

    const handleEditStage = (stage: WorkflowStage) => {
        setEditingStage(stage);
        setStageForm({
            stage_code: stage.stage_code,
            stage_name: stage.stage_name,
            stage_description: stage.stage_description || "",
            stage_order: stage.stage_order,
            stage_type: stage.stage_type,
            color: stage.color,
            icon: stage.icon || "CheckCircle",
            is_initial: stage.is_initial,
            is_terminal: stage.is_terminal,
            is_active: stage.is_active,
        });
        setIsStageDialogOpen(true);
    };

    const handleSubmitStage = () => {
        if (!stageForm.stage_code || !stageForm.stage_name) {
            toast({ title: "Please fill in required fields", variant: "destructive" });
            return;
        }

        if (editingStage) {
            updateStageMutation.mutate({ id: editingStage.id, data: stageForm as any });
        } else {
            createStageMutation.mutate(stageForm as any);
        }
    };

    const handleSubmitTransition = () => {
        if (!transitionForm.from_stage_id || !transitionForm.to_stage_id || !transitionForm.transition_name) {
            toast({ title: "Please fill in required fields", variant: "destructive" });
            return;
        }

        createTransitionMutation.mutate(transitionForm as any);
    };

    const getStageIcon = (iconName: string | null) => {
        if (!iconName) return Clock;
        return STAGE_ICONS[iconName] || Clock;
    };

    const getStageById = (id: string) => stages?.find(s => s.id === id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <GitBranch className="text-primary" size={20} />
                        Approval Workflow
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Configure stages and transitions for {productName || "this product"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {(!stages || stages.length === 0) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => createDefaultWorkflowMutation.mutate()}
                            disabled={createDefaultWorkflowMutation.isPending}
                        >
                            {createDefaultWorkflowMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            <Zap size={16} className="mr-2" />
                            Use Default Workflow
                        </Button>
                    )}
                    <Button size="sm" onClick={() => setIsStageDialogOpen(true)}>
                        <Plus size={16} className="mr-2" />
                        Add Stage
                    </Button>
                </div>
            </div>

            {/* Workflow Visualization */}
            {stagesLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : stages && stages.length > 0 ? (
                <div className="space-y-4">
                    {/* Visual Pipeline */}
                    <Card className="border-border/50 overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Workflow Pipeline</CardTitle>
                            <CardDescription>
                                {stages.length} stages configured. Click on a stage to edit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap items-center gap-2">
                                {stages.map((stage, index) => {
                                    const IconComponent = getStageIcon(stage.icon);
                                    return (
                                        <div key={stage.id} className="flex items-center">
                                            <div
                                                className={`relative group cursor-pointer transition-transform hover:scale-105 ${!stage.is_active ? 'opacity-50' : ''}`}
                                                onClick={() => handleEditStage(stage)}
                                            >
                                                <div
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border-2"
                                                    style={{
                                                        borderColor: stage.color,
                                                        backgroundColor: `${stage.color}20`
                                                    }}
                                                >
                                                    <IconComponent size={16} style={{ color: stage.color }} />
                                                    <span className="text-sm font-medium" style={{ color: stage.color }}>
                                                        {stage.stage_name}
                                                    </span>
                                                    {stage.is_initial && (
                                                        <Badge variant="secondary" className="text-[10px] px-1">Start</Badge>
                                                    )}
                                                    {stage.is_terminal && (
                                                        <Badge variant="secondary" className="text-[10px] px-1">End</Badge>
                                                    )}
                                                </div>
                                                <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 bg-background border">
                                                        <Pencil size={10} />
                                                    </Button>
                                                </div>
                                            </div>
                                            {index < stages.length - 1 && !stage.is_terminal && (
                                                <ArrowRight className="text-muted-foreground mx-1" size={16} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stages List */}
                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Stage Details</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsTransitionDialogOpen(true)}
                                    disabled={stages.length < 2}
                                >
                                    <ArrowRight size={14} className="mr-2" />
                                    Add Transition
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {stages.map((stage) => {
                                    const IconComponent = getStageIcon(stage.icon);
                                    const stageTransitions = transitions?.filter(t => t.from_stage_id === stage.id) || [];

                                    return (
                                        <div
                                            key={stage.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${!stage.is_active ? 'opacity-50 bg-muted/30' : 'bg-muted/10'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${stage.color}20` }}
                                                >
                                                    <IconComponent size={16} style={{ color: stage.color }} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{stage.stage_name}</span>
                                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                            {stage.stage_code}
                                                        </code>
                                                        <Badge variant="outline" className="text-xs capitalize">
                                                            {stage.stage_type}
                                                        </Badge>
                                                        {stage.is_initial && <Badge className="text-xs">Initial</Badge>}
                                                        {stage.is_terminal && <Badge variant="secondary" className="text-xs">Terminal</Badge>}
                                                    </div>
                                                    {stage.stage_description && (
                                                        <p className="text-xs text-muted-foreground">{stage.stage_description}</p>
                                                    )}
                                                    {stageTransitions.length > 0 && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="text-xs text-muted-foreground">Transitions:</span>
                                                            {stageTransitions.map((t) => (
                                                                <Badge key={t.id} variant="outline" className="text-xs">
                                                                    {t.transition_name} → {getStageById(t.to_stage_id)?.stage_name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Order: {stage.stage_order}</span>
                                                <Button variant="ghost" size="icon" onClick={() => handleEditStage(stage)}>
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteStage(stage)}>
                                                    <Trash2 size={14} className="text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="border-border/50">
                    <CardContent className="py-12 text-center">
                        <GitBranch className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No workflow configured</h3>
                        <p className="text-muted-foreground mb-4">
                            Start by adding stages or use the default workflow template
                        </p>
                        <div className="flex justify-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => createDefaultWorkflowMutation.mutate()}
                                disabled={createDefaultWorkflowMutation.isPending}
                            >
                                <Zap size={16} className="mr-2" />
                                Use Default Workflow
                            </Button>
                            <Button onClick={() => setIsStageDialogOpen(true)}>
                                <Plus size={16} className="mr-2" />
                                Create Custom
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stage Dialog */}
            <Dialog open={isStageDialogOpen} onOpenChange={(open) => {
                setIsStageDialogOpen(open);
                if (!open) {
                    setEditingStage(null);
                    resetStageForm();
                }
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingStage ? "Edit Workflow Stage" : "Add Workflow Stage"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Stage Code *</Label>
                                <Input
                                    value={stageForm.stage_code}
                                    onChange={(e) => setStageForm({ ...stageForm, stage_code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                    placeholder="e.g., document_review"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Display Name *</Label>
                                <Input
                                    value={stageForm.stage_name}
                                    onChange={(e) => setStageForm({ ...stageForm, stage_name: e.target.value })}
                                    placeholder="e.g., Document Review"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={stageForm.stage_description}
                                onChange={(e) => setStageForm({ ...stageForm, stage_description: e.target.value })}
                                placeholder="What happens at this stage?"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Stage Type</Label>
                                <Select value={stageForm.stage_type} onValueChange={(v: any) => setStageForm({ ...stageForm, stage_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="automatic">Automatic</SelectItem>
                                        <SelectItem value="conditional">Conditional</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Order</Label>
                                <Input
                                    type="number"
                                    value={stageForm.stage_order}
                                    onChange={(e) => setStageForm({ ...stageForm, stage_order: Number(e.target.value) })}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={stageForm.color}
                                        onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                                        className="w-12 h-10 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={stageForm.color}
                                        onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                                        placeholder="#3b82f6"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(STAGE_ICONS).map((iconName) => {
                                    const Icon = STAGE_ICONS[iconName];
                                    return (
                                        <Button
                                            key={iconName}
                                            type="button"
                                            variant={stageForm.icon === iconName ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setStageForm({ ...stageForm, icon: iconName })}
                                            className="w-10 h-10 p-0"
                                        >
                                            <Icon size={18} />
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>Initial Stage (starting point)</Label>
                                <Switch
                                    checked={stageForm.is_initial}
                                    onCheckedChange={(checked) => setStageForm({ ...stageForm, is_initial: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Terminal Stage (end point)</Label>
                                <Switch
                                    checked={stageForm.is_terminal}
                                    onCheckedChange={(checked) => setStageForm({ ...stageForm, is_terminal: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Active</Label>
                                <Switch
                                    checked={stageForm.is_active}
                                    onCheckedChange={(checked) => setStageForm({ ...stageForm, is_active: checked })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitStage}
                                disabled={createStageMutation.isPending || updateStageMutation.isPending}
                            >
                                {(createStageMutation.isPending || updateStageMutation.isPending) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {editingStage ? "Update Stage" : "Add Stage"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Transition Dialog */}
            <Dialog open={isTransitionDialogOpen} onOpenChange={(open) => {
                setIsTransitionDialogOpen(open);
                if (!open) resetTransitionForm();
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add Stage Transition</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>From Stage *</Label>
                                <Select value={transitionForm.from_stage_id} onValueChange={(v) => setTransitionForm({ ...transitionForm, from_stage_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stages?.filter(s => !s.is_terminal).map((stage) => (
                                            <SelectItem key={stage.id} value={stage.id}>
                                                {stage.stage_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>To Stage *</Label>
                                <Select value={transitionForm.to_stage_id} onValueChange={(v) => setTransitionForm({ ...transitionForm, to_stage_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stages?.filter(s => s.id !== transitionForm.from_stage_id).map((stage) => (
                                            <SelectItem key={stage.id} value={stage.id}>
                                                {stage.stage_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Transition Label *</Label>
                                <Input
                                    value={transitionForm.transition_name}
                                    onChange={(e) => setTransitionForm({ ...transitionForm, transition_name: e.target.value })}
                                    placeholder="e.g., Approve, Reject"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Action Type</Label>
                                <Select value={transitionForm.transition_action} onValueChange={(v) => setTransitionForm({ ...transitionForm, transition_action: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="approve">Approve</SelectItem>
                                        <SelectItem value="reject">Reject</SelectItem>
                                        <SelectItem value="escalate">Escalate</SelectItem>
                                        <SelectItem value="return">Return</SelectItem>
                                        <SelectItem value="hold">Hold</SelectItem>
                                        <SelectItem value="auto">Automatic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>Requires Comment</Label>
                                <Switch
                                    checked={transitionForm.requires_comment}
                                    onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, requires_comment: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Requires Document Upload</Label>
                                <Switch
                                    checked={transitionForm.requires_document}
                                    onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, requires_document: checked })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="outline" onClick={() => setIsTransitionDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitTransition}
                                disabled={createTransitionMutation.isPending}
                            >
                                {createTransitionMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Add Transition
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteStage} onOpenChange={() => setDeleteStage(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Workflow Stage?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the "{deleteStage?.stage_name}" stage and all its transitions.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteStage && deleteStageMutation.mutate(deleteStage.id)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default WorkflowConfiguration;
