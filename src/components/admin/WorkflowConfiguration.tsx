import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    GitBranch,
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
    Info,
    ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types - placeholder until migration is run
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

// Default stages for visualization
const DEFAULT_STAGES = [
    { code: "pending", name: "Pending", description: "Application submitted", color: "#f59e0b", icon: "Clock" },
    { code: "under_review", name: "Under Review", description: "Being reviewed", color: "#3b82f6", icon: "Eye" },
    { code: "approved", name: "Approved", description: "Loan approved", color: "#10b981", icon: "CheckCircle" },
    { code: "disbursed", name: "Disbursed", description: "Funds sent", color: "#22c55e", icon: "Banknote" },
    { code: "active", name: "Active", description: "Ongoing repayments", color: "#14b8a6", icon: "Activity" },
    { code: "completed", name: "Completed", description: "Fully repaid", color: "#10b981", icon: "Trophy" },
    { code: "rejected", name: "Rejected", description: "Application rejected", color: "#ef4444", icon: "XCircle" },
    { code: "defaulted", name: "Defaulted", description: "Loan in default", color: "#dc2626", icon: "AlertTriangle" },
];

interface WorkflowConfigurationProps {
    productId: string;
    productName?: string;
}

const WorkflowConfiguration = ({ productId, productName }: WorkflowConfigurationProps) => {
    const { toast } = useToast();

    const getStageIcon = (iconName: string | null) => {
        if (!iconName) return Clock;
        return STAGE_ICONS[iconName] || Clock;
    };

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
                        Workflow stages for {productName || "this product"}
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
                                Custom workflow configuration will be available after the database migration is completed.
                                Currently, loans follow the standard status workflow shown below.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Default Workflow Visualization */}
            <Card className="border-border/50 overflow-hidden">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Standard Loan Workflow</CardTitle>
                    <CardDescription>
                        Default workflow stages for loan applications
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                        {DEFAULT_STAGES.map((stage, index) => {
                            const IconComponent = getStageIcon(stage.icon);
                            return (
                                <div key={stage.code} className="flex items-center">
                                    <div
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border-2"
                                        style={{
                                            borderColor: stage.color,
                                            backgroundColor: `${stage.color}20`
                                        }}
                                    >
                                        <IconComponent size={16} style={{ color: stage.color }} />
                                        <span className="text-sm font-medium" style={{ color: stage.color }}>
                                            {stage.name}
                                        </span>
                                    </div>
                                    {index < DEFAULT_STAGES.length - 1 && index !== 5 && (
                                        <ArrowRight size={16} className="mx-1 text-muted-foreground" />
                                    )}
                                    {index === 5 && (
                                        <span className="mx-2 text-xs text-muted-foreground">|</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Stage Details */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Stage Descriptions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {DEFAULT_STAGES.map((stage) => {
                            const IconComponent = getStageIcon(stage.icon);
                            return (
                                <div
                                    key={stage.code}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20"
                                >
                                    <div
                                        className="p-2 rounded-md"
                                        style={{ backgroundColor: `${stage.color}20` }}
                                    >
                                        <IconComponent size={16} style={{ color: stage.color }} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{stage.name}</p>
                                        <p className="text-xs text-muted-foreground">{stage.description}</p>
                                        <Badge variant="outline" className="mt-1 text-[10px]">
                                            {stage.code}
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default WorkflowConfiguration;
