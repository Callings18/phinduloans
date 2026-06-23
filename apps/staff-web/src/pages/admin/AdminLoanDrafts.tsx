import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { FileEdit, RefreshCw, Search, Trash2, ArrowRight, Inbox } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Badge } from "@phinduloans/shared/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { LOAN_PRODUCT_MODULES, type LoanProductCode } from "@phinduloans/shared/config/loanProductModules";

type DraftRow = {
  id: string;
  staff_user_id: string;
  borrower_id: string | null;
  product_code: string;
  form_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type BorrowerLite = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  nrc_number: string | null;
};

const PRODUCT_NAMES: Record<string, string> = LOAN_PRODUCT_MODULES.reduce(
  (acc, m) => ({ ...acc, [m.code]: m.name }),
  {} as Record<string, string>,
);

const productCreatePath = (code: string, draftId: string, borrowerId: string | null) => {
  const module = LOAN_PRODUCT_MODULES.find((m) => m.code === (code as LoanProductCode));
  const base = module?.createPath || `/admin/houses/${code}/loans/create`;
  const params = new URLSearchParams({ draft: draftId });
  if (borrowerId) params.set("borrower", borrowerId);
  return `${base}?${params.toString()}`;
};

const draftCompletionScore = (draft: DraftRow): number => {
  const f = (draft.form_data || {}) as Record<string, unknown>;
  const checks = [
    !!f.loanAmount,
    !!f.termValue,
    !!f.loanPurpose,
    !!f.monthlyIncome,
    !!f.employmentType,
    !!f.contactNumber,
    !!f.idNumber,
    !!f.residentialAddress,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
};

export default function AdminLoanDrafts() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<DraftRow | null>(null);

  const draftsQueryKey = ["admin-loan-drafts"] as const;

  const { data: drafts, isLoading, isError, refetch } = useQuery({
    queryKey: draftsQueryKey,
    queryFn: async (): Promise<DraftRow[]> => {
      if (!user?.id) return [];
      // No staff_user_id filter: RLS returns every draft visible to this role
      // (whole lending team — see migration loan_drafts_team_visibility_rls).
      const { data, error } = await supabase
        .from("loan_application_drafts")
        .select("id, staff_user_id, borrower_id, product_code, form_data, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DraftRow[];
    },
    enabled: !!user?.id,
  });

  // Live updates when anyone on the team saves / deletes a draft (requires
  // supabase_realtime publication on loan_application_drafts — see migration).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("loan_application_drafts_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_application_drafts" },
        () => {
          queryClient.invalidateQueries({ queryKey: draftsQueryKey });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Look up borrower display info for each draft. We grab the union of ids in one query.
  const borrowerIds = useMemo(
    () => Array.from(new Set((drafts || []).map((d) => d.borrower_id).filter((x): x is string => !!x))),
    [drafts],
  );
  const { data: borrowers } = useQuery({
    queryKey: ["admin-loan-drafts-borrowers", borrowerIds.sort().join(",")],
    queryFn: async (): Promise<Record<string, BorrowerLite>> => {
      if (borrowerIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, nrc_number")
        .in("id", borrowerIds);
      if (error) throw error;
      const map: Record<string, BorrowerLite> = {};
      (data || []).forEach((b) => {
        map[b.id] = b as BorrowerLite;
      });
      return map;
    },
    enabled: borrowerIds.length > 0,
  });

  const staffIds = useMemo(
    () => Array.from(new Set((drafts || []).map((d) => d.staff_user_id))),
    [drafts],
  );

  const { data: staffById } = useQuery({
    queryKey: ["admin-loan-drafts-staff", staffIds.sort().join(",")],
    queryFn: async (): Promise<Record<string, { id: string; full_name: string | null; email: string }>> => {
      if (staffIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", staffIds);
      if (error) throw error;
      const map: Record<string, { id: string; full_name: string | null; email: string }> = {};
      (data || []).forEach((s) => {
        map[s.id] = s as { id: string; full_name: string | null; email: string };
      });
      return map;
    },
    enabled: staffIds.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("loan_application_drafts").delete().eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftsQueryKey });
      toast({ title: "Draft deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete draft", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const list = drafts || [];
    const q = search.trim().toLowerCase();
    return list.filter((d) => {
      if (productFilter !== "all" && d.product_code !== productFilter) return false;
      if (!q) return true;
      const b = d.borrower_id ? borrowers?.[d.borrower_id] : null;
      const saver = staffById?.[d.staff_user_id];
      const haystack = [
        b?.full_name,
        b?.email,
        b?.phone,
        b?.nrc_number,
        saver?.full_name,
        saver?.email,
        d.product_code,
        PRODUCT_NAMES[d.product_code],
        (d.form_data as any)?.loanPurpose,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [drafts, search, productFilter, borrowers, staffById]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-background px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Lending
              </p>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                <FileEdit className="h-5 w-5 text-primary" />
                Loan application drafts
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Shared across the lending team — new saves and deletes sync automatically. Each row shows who saved it;
                only they (or an admin) can delete it. Resuming opens the form; pressing <strong>Save Draft</strong> there
                stores a copy under <em>your</em> staff account for the same borrower and product.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pb-4 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Borrower, staff name, email, NRC, purpose…"
                className="h-9 pl-8"
              />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {LOAN_PRODUCT_MODULES.filter((m) => m.enabled).map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 flex-row items-center justify-between">
            <CardTitle className="text-sm">
              {isLoading ? "Loading drafts…" : `${filtered.length} draft${filtered.length === 1 ? "" : "s"}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {isError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                Could not load drafts. Try refreshing.
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
                <Inbox className="h-9 w-9 text-muted-foreground/60" />
                <p className="text-sm font-medium">No drafts match</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  When anyone on the team clicks <strong>Save Draft</strong> on loan creation, it appears here for
                  everyone with lending access. Try clearing filters, or pull <strong>Refresh</strong> if you
                  expected new rows.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {filtered.map((draft) => {
                const borrower = draft.borrower_id ? borrowers?.[draft.borrower_id] : null;
                const saver = staffById?.[draft.staff_user_id];
                const isOwnDraft = user?.id === draft.staff_user_id;
                const canDelete = isOwnDraft || isAdmin;
                const score = draftCompletionScore(draft);
                const productName = PRODUCT_NAMES[draft.product_code] || draft.product_code;
                const purpose = (draft.form_data as any)?.loanPurpose as string | undefined;
                const amount = (draft.form_data as any)?.loanAmount as string | undefined;
                return (
                  <div
                    key={draft.id}
                    className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] py-0 h-5">
                          {productName}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            score >= 80
                              ? "text-[10px] py-0 h-5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : score >= 40
                              ? "text-[10px] py-0 h-5 border-amber-500/40 text-amber-600 dark:text-amber-400"
                              : "text-[10px] py-0 h-5 border-muted-foreground/40 text-muted-foreground"
                          }
                        >
                          {score}% complete
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 h-5 ${isOwnDraft ? "border-primary/40 text-primary" : ""}`}
                          title="Staff member who saved this draft"
                        >
                          Saved by{" "}
                          {saver?.full_name || saver?.email || draft.staff_user_id.slice(0, 8) + "…"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {borrower ? borrower.full_name || borrower.email : "(no borrower selected)"}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {borrower?.nrc_number && <span>NRC {borrower.nrc_number}</span>}
                        {borrower?.phone && <span>{borrower.phone}</span>}
                        {amount && <span>K {Number(amount).toLocaleString()}</span>}
                        {purpose && <span className="truncate">Purpose: {purpose}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs"
                        asChild
                      >
                        <Link to={productCreatePath(draft.product_code, draft.id, draft.borrower_id)}>
                          Resume
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? "Delete this draft"
                            : "Only the person who saved this draft (or an admin) can delete it"
                        }
                        onClick={() => {
                          if (!canDelete) {
                            toast({
                              title: "Cannot delete",
                              description: "Only the staff member who saved this draft, or an admin, can remove it.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setConfirmDelete(draft);
                        }}
                        aria-label="Delete draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the saved draft. The borrower&apos;s record is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
