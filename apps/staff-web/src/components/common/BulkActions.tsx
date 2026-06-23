import React, { useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@phinduloans/shared/components/ui/dropdown-menu";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Label } from "@phinduloans/shared/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@phinduloans/shared/components/ui/select";
import {
    CheckSquare,
    ChevronDown,
    CheckCircle,
    XCircle,
    UserPlus,
    Trash2,
    Mail,
    MessageSquare,
    FileText,
    Download,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@phinduloans/shared/lib/utils";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

export interface BulkAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    variant?: "default" | "destructive" | "success";
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
    requiresInput?: boolean;
    inputLabel?: string;
    inputType?: "textarea" | "select";
    selectOptions?: { value: string; label: string }[];
}

interface BulkActionsProps {
    selectedIds: string[];
    onAction: (actionId: string, inputValue?: string) => Promise<void>;
    actions: BulkAction[];
    entityName?: string;
    className?: string;
    onClearSelection?: () => void;
}

// Default actions for loan applications
export const defaultLoanApplicationActions: BulkAction[] = [
    {
        id: "approve",
        label: "Approve Selected",
        icon: <CheckCircle size={16} />,
        variant: "success",
        requiresConfirmation: true,
        confirmationMessage: "Are you sure you want to approve these applications?",
    },
    {
        id: "reject",
        label: "Reject Selected",
        icon: <XCircle size={16} />,
        variant: "destructive",
        requiresConfirmation: true,
        requiresInput: true,
        inputLabel: "Rejection Reason",
        inputType: "textarea",
        confirmationMessage: "Are you sure you want to reject these applications?",
    },
    {
        id: "assign",
        label: "Assign to Officer",
        icon: <UserPlus size={16} />,
        requiresInput: true,
        inputLabel: "Select Officer",
        inputType: "select",
    },
    {
        id: "send_email",
        label: "Send Email",
        icon: <Mail size={16} />,
        requiresInput: true,
        inputLabel: "Email Message",
        inputType: "textarea",
    },
    {
        id: "send_sms",
        label: "Send SMS",
        icon: <MessageSquare size={16} />,
        requiresInput: true,
        inputLabel: "SMS Message",
        inputType: "textarea",
    },
    {
        id: "export",
        label: "Export to CSV",
        icon: <Download size={16} />,
    },
    {
        id: "delete",
        label: "Delete Selected",
        icon: <Trash2 size={16} />,
        variant: "destructive",
        requiresConfirmation: true,
        confirmationMessage:
            "Are you sure you want to delete these items? This action cannot be undone.",
    },
];

// Default actions for repayments
export const defaultRepaymentActions: BulkAction[] = [
    {
        id: "mark_paid",
        label: "Mark as Paid",
        icon: <CheckCircle size={16} />,
        variant: "success",
        requiresConfirmation: true,
        confirmationMessage: "Are you sure you want to mark these repayments as paid?",
    },
    {
        id: "send_reminder",
        label: "Send Payment Reminder",
        icon: <MessageSquare size={16} />,
        requiresInput: true,
        inputLabel: "Reminder Message",
        inputType: "textarea",
    },
    {
        id: "export",
        label: "Export to CSV",
        icon: <Download size={16} />,
    },
];

const BulkActions: React.FC<BulkActionsProps> = ({
    selectedIds,
    onAction,
    actions,
    entityName = "items",
    className,
    onClearSelection,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeAction, setActiveAction] = useState<BulkAction | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showInputDialog, setShowInputDialog] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const { toast } = useToast();

    const handleActionClick = (action: BulkAction) => {
        if (selectedIds.length === 0) {
            toast({
                title: "No items selected",
                description: `Please select ${entityName} to perform this action.`,
                variant: "destructive",
            });
            return;
        }

        setActiveAction(action);

        if (action.requiresInput) {
            setShowInputDialog(true);
        } else if (action.requiresConfirmation) {
            setShowConfirmDialog(true);
        } else {
            executeAction(action.id);
        }
    };

    const executeAction = async (actionId: string, value?: string) => {
        setIsLoading(true);
        try {
            await onAction(actionId, value);
            toast({
                title: "Action completed",
                description: `Successfully processed ${selectedIds.length} ${entityName}.`,
            });
        } catch (error: any) {
            toast({
                title: "Action failed",
                description: error.message || "An error occurred while processing the action.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setActiveAction(null);
            setShowConfirmDialog(false);
            setShowInputDialog(false);
            setInputValue("");
        }
    };

    const handleConfirm = () => {
        if (activeAction) {
            executeAction(activeAction.id, inputValue || undefined);
        }
    };

    const handleInputSubmit = () => {
        if (!inputValue.trim() && activeAction?.inputType === "textarea") {
            toast({
                title: "Input required",
                description: `Please provide ${activeAction?.inputLabel?.toLowerCase()}.`,
                variant: "destructive",
            });
            return;
        }

        if (activeAction?.requiresConfirmation) {
            setShowInputDialog(false);
            setShowConfirmDialog(true);
        } else {
            executeAction(activeAction!.id, inputValue);
        }
    };

    if (selectedIds.length === 0) {
        return null;
    }

    return (
        <>
            <div
                className={cn(
                    "flex items-center gap-3 p-3 rounded-lg glass border-border/50 animate-in fade-in slide-in-from-bottom-4",
                    className
                )}
            >
                <div className="flex items-center gap-2">
                    <CheckSquare size={18} className="text-primary" />
                    <span className="text-sm font-medium">
                        {selectedIds.length} {entityName} selected
                    </span>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-border/50 hover:border-primary/50"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <>
                                    Bulk Actions
                                    <ChevronDown size={14} />
                                </>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 glass border-border/50">
                        {actions.map((action, index) => (
                            <React.Fragment key={action.id}>
                                {index > 0 && action.variant === "destructive" && (
                                    <DropdownMenuSeparator />
                                )}
                                <DropdownMenuItem
                                    onClick={() => handleActionClick(action)}
                                    className={cn(
                                        "cursor-pointer gap-2",
                                        action.variant === "destructive" &&
                                        "text-destructive focus:text-destructive",
                                        action.variant === "success" &&
                                        "text-green-500 focus:text-green-500"
                                    )}
                                >
                                    {action.icon}
                                    {action.label}
                                </DropdownMenuItem>
                            </React.Fragment>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {onClearSelection && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Clear selection
                    </Button>
                )}
            </div>

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent className="glass border-border/50">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {activeAction?.variant === "destructive" ? (
                                <AlertTriangle className="text-destructive" size={20} />
                            ) : (
                                <CheckCircle className="text-primary" size={20} />
                            )}
                            Confirm Action
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {activeAction?.confirmationMessage}
                            <br />
                            <span className="font-medium text-foreground mt-2 block">
                                This will affect {selectedIds.length} {entityName}.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={cn(
                                activeAction?.variant === "destructive" && "bg-destructive hover:bg-destructive/90",
                                activeAction?.variant === "success" && "bg-green-600 hover:bg-green-700"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin mr-2" />
                            ) : null}
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Input Dialog */}
            <Dialog open={showInputDialog} onOpenChange={setShowInputDialog}>
                <DialogContent className="glass border-border/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {activeAction?.icon}
                            {activeAction?.label}
                        </DialogTitle>
                        <DialogDescription>
                            This action will be applied to {selectedIds.length} selected {entityName}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{activeAction?.inputLabel}</Label>
                            {activeAction?.inputType === "select" ? (
                                <Select value={inputValue} onValueChange={setInputValue}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Select ${activeAction?.inputLabel?.toLowerCase()}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeAction?.selectOptions?.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={`Enter ${activeAction?.inputLabel?.toLowerCase()}...`}
                                    rows={4}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowInputDialog(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleInputSubmit}
                            disabled={isLoading}
                            className={cn(
                                activeAction?.variant === "destructive" && "bg-destructive hover:bg-destructive/90",
                                activeAction?.variant === "success" && "bg-green-600 hover:bg-green-700"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin mr-2" />
                            ) : null}
                            {activeAction?.requiresConfirmation ? "Continue" : "Submit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default BulkActions;
