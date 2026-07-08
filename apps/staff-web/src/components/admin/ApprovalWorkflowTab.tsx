import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import {
  CheckCircle,
  Circle,
  Clock,
  FileSearch,
  ThumbsUp,
  Shield,
  Banknote,
  Loader2,
  MessageSquare,
  Plus,
  User,
} from "lucide-react";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { logAudit } from "@phinduloans/shared/utils/auditLog";
import { notifyBorrowerVisibleNote } from "@phinduloans/shared/utils/notifyBorrowerPortal";

interface ApprovalWorkflowTabProps {
  loan: {
    id: string;
    user_id: string;
    status: string;
    approval_stage?: string | null;
    document_verified_by?: string | null;
    document_verified_at?: string | null;
    finance_verified_by?: string | null;
    finance_verified_at?: string | null;
    recommended_by?: string | null;
    recommended_at?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    disbursed_by?: string | null;
    disbursed_at?: string | null;
    full_name: string;
  };
}

interface WorkflowStage {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  completedBy: string | null | undefined;
  completedAt: string | null | undefined;
  actionLabel: string;
  permissionModule: string;
  permissionAction: string;
}

interface LoanNote {
  id: string;
  loan_id: string;
  user_id: string;
  note: string;
  note_type: string;
  is_internal: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export default function ApprovalWorkflowTab({ loan }: ApprovalWorkflowTabProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [visibleToBorrower, setVisibleToBorrower] = useState(false);

  // Define the 4 stages
  const stages: WorkflowStage[] = [
    {
      key: "document_review",
      label: "Document Review",
      description: "Documents verified by reviewer",
      icon: FileSearch,
      completedBy: loan.document_verified_by,
      completedAt: loan.document_verified_at,
      actionLabel: "Mark Documents Verified",
      permissionModule: "loans",
      permissionAction: "verify_documents",
    },
    {
      key: "recommendation",
      label: "Recommendation",
      description: "Loan recommended for approval",
      icon: ThumbsUp,
      completedBy: loan.recommended_by,
      completedAt: loan.recommended_at,
      actionLabel: "Recommend for Approval",
      permissionModule: "loans",
      permissionAction: "recommend",
    },
    {
      key: "approval",
      label: "Final Approval",
      description: "Loan approved by authorizer",
      icon: Shield,
      completedBy: loan.approved_by,
      completedAt: loan.approved_at,
      actionLabel: "Approve Loan",
      permissionModule: "loans",
      permissionAction: "approve",
    },
    {
      key: "disbursement",
      label: "Disbursement",
      description: "Funds disbursed to borrower",
      icon: Banknote,
      completedBy: loan.disbursed_by,
      completedAt: loan.disbursed_at,
      actionLabel: "Disburse Funds",
      permissionModule: "disbursement",
      permissionAction: "disburse",
    },
  ];

  // Determine current stage index
  const currentStageIndex = stages.findIndex((s) => !s.completedBy);
  const allComplete = currentStageIndex === -1;

  // Fetch staff names for completed stages
  const completedUserIds = stages
    .map((s) => s.completedBy)
    .filter(Boolean) as string[];

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-workflow", ...completedUserIds],
    queryFn: async () => {
      if (completedUserIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", completedUserIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.full_name || "Staff";
      });
      return map;
    },
    enabled: completedUserIds.length > 0,
  });

  // Fetch loan notes
  const { data: loanNotes, isLoading: notesLoading } = useQuery({
    queryKey: ["loan-notes", loan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_notes")
        .select("*")
        .eq("loan_id", loan.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoanNote[];
    },
    enabled: !!loan.id,
  });

  // Fetch note author names
  const noteUserIds = [...new Set((loanNotes || []).map((n) => n.user_id))];
  const { data: noteProfiles } = useQuery({
    queryKey: ["note-profiles", ...noteUserIds],
    queryFn: async () => {
      if (noteUserIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", noteUserIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.full_name || "Staff";
      });
      return map;
    },
    enabled: noteUserIds.length > 0,
  });

  // Stage action mutation
  const stageActionMutation = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!user) throw new Error("Not authenticated");
      const now = new Date().toISOString();
      const updateData: Record<string, any> = { updated_at: now };

      if (stageKey === "document_review") {
        updateData.document_verified_by = user.id;
        updateData.document_verified_at = now;
        updateData.approval_stage = "documents_verified";
      } else if (stageKey === "recommendation") {
        updateData.recommended_by = user.id;
        updateData.recommended_at = now;
        updateData.approval_stage = "recommended";
      } else if (stageKey === "approval") {
        updateData.approved_by = user.id;
        updateData.approved_at = now;
        updateData.reviewed_by = user.id;
        updateData.reviewed_at = now;
        updateData.approval_stage = "approved";
        updateData.status = "approved";
      } else if (stageKey === "disbursement") {
        updateData.disbursed_by = user.id;
        updateData.disbursed_at = now;
        updateData.approval_stage = "disbursed";
      }

      const { error } = await supabase
        .from("loan_applications")
        .update(updateData)
        .eq("id", loan.id);
      if (error) throw error;

      await logAudit({
        action: `WORKFLOW_${stageKey.toUpperCase()}`,
        entity_type: "loan_application",
        entity_id: loan.id,
      });

      return stageKey;
    },
    onSuccess: (stageKey) => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      const stage = stages.find((s) => s.key === stageKey);
      toast.success(`${stage?.label || stageKey} completed`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update stage"),
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !noteText.trim()) throw new Error("Note is required");
      const { error } = await supabase.from("loan_notes").insert({
        loan_id: loan.id,
        user_id: user.id,
        note: noteText.trim(),
        note_type: visibleToBorrower ? "visible_to_borrower" : "internal",
        is_internal: !visibleToBorrower,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      const sentNote = noteText.trim();
      const notifyBorrower = visibleToBorrower;
      queryClient.invalidateQueries({ queryKey: ["loan-notes", loan.id] });
      setNoteText("");
      setVisibleToBorrower(false);
      toast.success("Note added");
      if (notifyBorrower && sentNote) {
        await notifyBorrowerVisibleNote(loan.user_id, loan.full_name, sentNote, loan.id);
      }
    },
    onError: (err: any) => toast.error(err.message || "Failed to add note"),
  });

  return (
    <div className="space-y-6">
      {/* Approval Workflow Stages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield size={16} className="text-primary" /> Approval Workflow
          </CardTitle>
          <CardDescription>
            Multi-level review and approval stages for this loan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {stages.map((stage, index) => {
              const isCompleted = !!stage.completedBy;
              const isCurrent = index === currentStageIndex;
              const isLocked = index > currentStageIndex && !allComplete;
              const IconComponent = stage.icon;
              const staffName = stage.completedBy
                ? staffProfiles?.[stage.completedBy] || "Staff"
                : null;

              const hasPermission = can(stage.permissionModule, stage.permissionAction);
              // For disbursement, don't show action here (separate flow exists)
              const showAction = isCurrent && hasPermission && stage.key !== "disbursement";

              return (
                <div key={stage.key} className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                        isCompleted
                          ? "bg-success/20 border-success text-success"
                          : isCurrent
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle size={18} />
                      ) : isCurrent ? (
                        <IconComponent size={18} />
                      ) : (
                        <Circle size={18} />
                      )}
                    </div>
                    {index < stages.length - 1 && (
                      <div
                        className={`w-0.5 h-10 ${
                          isCompleted ? "bg-success" : "bg-border"
                        }`}
                      />
                    )}
                  </div>

                  {/* Stage content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium text-sm ${
                          isCompleted
                            ? "text-success"
                            : isCurrent
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </p>
                      {isCompleted && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-success/10 text-success border-success/30"
                        >
                          Completed
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-primary/10 text-primary border-primary/30"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stage.description}
                    </p>
                    {isCompleted && staffName && stage.completedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By <span className="font-medium text-foreground">{staffName}</span>{" "}
                        on {format(new Date(stage.completedAt), "MMM dd, yyyy HH:mm")}
                      </p>
                    )}
                    {showAction && (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => stageActionMutation.mutate(stage.key)}
                        disabled={stageActionMutation.isPending}
                      >
                        {stageActionMutation.isPending ? (
                          <Loader2 size={14} className="animate-spin mr-1" />
                        ) : (
                          <CheckCircle size={14} className="mr-1" />
                        )}
                        {stage.actionLabel}
                      </Button>
                    )}
                    {isCurrent && !hasPermission && stage.key !== "disbursement" && (
                      <p className="text-xs text-warning mt-1">
                        You don't have permission for this action
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Internal Notes Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" /> Internal Notes
          </CardTitle>
          <CardDescription>
            Staff notes and communication for this loan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add note form */}
          <div className="space-y-3">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this loan..."
              rows={3}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="visible-to-borrower"
                  checked={visibleToBorrower}
                  onCheckedChange={(checked) =>
                    setVisibleToBorrower(checked === true)
                  }
                />
                <label
                  htmlFor="visible-to-borrower"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Make visible to borrower
                </label>
              </div>
              <Button
                size="sm"
                onClick={() => addNoteMutation.mutate()}
                disabled={!noteText.trim() || addNoteMutation.isPending}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Plus size={14} className="mr-1" />
                )}
                Add Note
              </Button>
            </div>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : loanNotes && loanNotes.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {loanNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {noteProfiles?.[note.user_id] || "Staff"}
                      </span>
                      {note.note_type === "visible_to_borrower" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-info/10 text-info border-info/30"
                        >
                          Visible to borrower
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(note.created_at), "MMM dd, yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm mt-2 text-foreground">{note.note}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notes yet. Add the first note above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
