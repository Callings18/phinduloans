import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";

interface LoanNote {
  id: string;
  loan_id: string;
  note: string;
  note_type: string | null;
  is_internal: boolean | null;
  created_at: string;
}

interface BorrowerLoanMessagesProps {
  loanId: string;
  adminNotes?: string | null;
}

export default function BorrowerLoanMessages({ loanId, adminNotes }: BorrowerLoanMessagesProps) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["borrower-loan-notes", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_notes")
        .select("id, loan_id, note, note_type, is_internal, created_at")
        .eq("loan_id", loanId)
        .or("is_internal.eq.false,note_type.eq.visible_to_borrower,note_type.eq.borrower_visible")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanNote[];
    },
    enabled: !!loanId,
  });

  useEffect(() => {
    if (!loanId) return;
    const channel = supabase
      .channel(`borrower-notes-${loanId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_notes", filter: `loan_id=eq.${loanId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-loan-notes", loanId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loanId, queryClient]);

  const visibleNotes = notes.filter(
    (n) => n.is_internal === false || n.note_type === "visible_to_borrower" || n.note_type === "borrower_visible",
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminNotes && visibleNotes.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          Messages from our team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {adminNotes && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <Badge variant="outline" className="text-xs mb-2">Application note</Badge>
            <p className="text-foreground whitespace-pre-wrap">{adminNotes}</p>
          </div>
        )}
        {visibleNotes.map((note) => (
          <div key={note.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <p className="text-foreground whitespace-pre-wrap">{note.note}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
