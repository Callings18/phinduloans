import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useHouseLoans, useHouseRepayments } from "@/hooks/useHouseData";
import { Search, Plus, Eye, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import PaginationControls from "@/components/common/PaginationControls";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EditPendingLoanDialog from "@/components/admin/EditPendingLoanDialog";

const DELETABLE_STATUSES = new Set([
  "pending",
  "under_review",
  "approved",
  "contract_signing",
  "awaiting_disbursement",
  "rejected",
  "crb_failed",
  "pmic_pending",
]);
const EDITABLE_STATUSES = new Set(["pending", "under_review", "approved"]);


const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Approved", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  awaiting_disbursement: { label: "Awaiting Disbursement", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  disbursed: { label: "Disbursed", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed: { label: "Completed", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  defaulted: { label: "Defaulted", className: "bg-red-600/20 text-red-500 border-red-600/30" },
  rejected: { label: "Rejected", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function HouseLoansPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans, isLoading } = useHouseLoans(productCode);
  const { data: repayments } = useHouseRepayments(productCode);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editLoan, setEditLoan] = useState<any>(null);
  const [deleteLoan, setDeleteLoan] = useState<any>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (loan: any) => {
      if (!loan) throw new Error("No loan selected");
      if (!DELETABLE_STATUSES.has(loan.status)) {
        throw new Error(`Cannot delete a loan in status "${loan.status}".`);
      }
      await supabase.from("loan_repayments").delete().eq("loan_id", loan.id);
      await supabase.from("disbursements").delete().eq("loan_id", loan.id);
      await supabase.from("loan_status_transitions").delete().eq("loan_id", loan.id);
      await supabase.from("loan_events").delete().eq("loan_id", loan.id);
      const { error } = await supabase.from("loan_applications").delete().eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan deleted");
      queryClient.invalidateQueries({ queryKey: ["house-loans"] });
      queryClient.invalidateQueries({ queryKey: ["house-report-summary"] });
      setDeleteLoan(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // Build overdue stats per loan from repayments — a loan is "overdue" if it has any
  // pending/overdue installment with due_date < today.
  const overdueByLoan = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const map: Record<string, { count: number; amount: number; oldestDueDate: string | null }> = {};
    (repayments ?? []).forEach((r: any) => {
      if (r.status === "paid" || r.status === "cancelled") return;
      if (!r.due_date || r.due_date >= today) return;
      const entry = map[r.loan_id] ?? { count: 0, amount: 0, oldestDueDate: null };
      entry.count += 1;
      entry.amount += Number(r.amount || 0);
      entry.oldestDueDate =
        !entry.oldestDueDate || r.due_date < entry.oldestDueDate ? r.due_date : entry.oldestDueDate;
      map[r.loan_id] = entry;
    });
    return map;
  }, [repayments]);

  const filtered = useMemo(() => {
    if (!loans) return [];
    return loans.filter((l: any) => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        l.full_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.nrc_number?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "overdue" ? Boolean(overdueByLoan[l.id]) : l.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [loans, search, statusFilter, overdueByLoan]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const totalAmount = (loans ?? []).reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0);
  const activeCount = (loans ?? []).filter((l: any) => ["active", "disbursed"].includes(l.status)).length;
  const overdueCount = Object.keys(overdueByLoan).length;

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (loans ?? []).forEach((l: any) => { map[l.status] = (map[l.status] || 0) + 1; });
    return map;
  }, [loans]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Loans</h2>
          <p className="text-sm text-muted-foreground">
            {(loans ?? []).length} total · {activeCount} active ·{" "}
            <span className={overdueCount > 0 ? "text-destructive font-medium" : ""}>
              {overdueCount} overdue
            </span>{" "}
            · K{totalAmount.toLocaleString()} portfolio
          </p>
        </div>
        <Button asChild size="sm"><Link to={`/admin/houses/${productCode}/loans/create`}><Plus size={16} className="mr-1" /> Create Loan</Link></Button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}>
          All ({(loans ?? []).length})
        </Button>
        {overdueCount > 0 && (
          <Button
            size="sm"
            variant={statusFilter === "overdue" ? "destructive" : "outline"}
            onClick={() => { setStatusFilter("overdue"); setCurrentPage(1); }}
            className={statusFilter !== "overdue" ? "border-destructive/50 text-destructive hover:bg-destructive/10" : ""}
          >
            <AlertTriangle size={12} className="mr-1" /> Overdue ({overdueCount})
          </Button>
        )}
        {Object.entries(statusCounts).sort().map(([status, count]) => (
          <Button key={status} size="sm" variant={statusFilter === status ? "default" : "outline"} onClick={() => { setStatusFilter(status); setCurrentPage(1); }}>
            {statusConfig[status]?.label || status} ({count})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input placeholder="Search by name, email, NRC, or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((l: any) => {
                  const cfg = statusConfig[l.status] || statusConfig.pending;
                  const od = overdueByLoan[l.id];
                  const daysLate = od?.oldestDueDate
                    ? Math.max(
                        0,
                        Math.floor(
                          (new Date(todayStr).getTime() - new Date(od.oldestDueDate).getTime()) /
                            (1000 * 60 * 60 * 24),
                        ),
                      )
                    : 0;
                  return (
                    <TableRow key={l.id} className={od ? "bg-destructive/5" : undefined}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{l.full_name || l.email}</p>
                          <p className="text-xs text-muted-foreground">{l.phone || l.nrc_number || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">K{Number(l.loan_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{l.loan_term_months} {l.term_unit || "months"}</TableCell>
                      <TableCell><Badge className={`${cfg.className} border text-xs`}>{cfg.label}</Badge></TableCell>
                      <TableCell>
                        {od ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="destructive" className="text-xs w-fit">
                              <AlertTriangle size={10} className="mr-1" />
                              {od.count} late · K{od.amount.toLocaleString()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {daysLate} day{daysLate === 1 ? "" : "s"} late
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.created_at ? format(new Date(l.created_at), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" variant="ghost" title="View">
                            <Link to={`/admin/houses/${productCode}/loans/${l.id}`}><Eye size={14} /></Link>
                          </Button>
                          {EDITABLE_STATUSES.has(l.status) && (
                            <Button size="sm" variant="ghost" title="Edit" onClick={() => setEditLoan(l)}>
                              <Pencil size={14} />
                            </Button>
                          )}
                          {DELETABLE_STATUSES.has(l.status) && (
                            <Button size="sm" variant="ghost" title="Delete" onClick={() => setDeleteLoan(l)} className="text-destructive hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginated.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No loans found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {filtered.length > pageSize && (
        <PaginationControls currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
      )}

      <EditPendingLoanDialog
        loan={editLoan}
        open={Boolean(editLoan)}
        onOpenChange={(o) => { if (!o) setEditLoan(null); }}
      />

      <AlertDialog open={Boolean(deleteLoan)} onOpenChange={(o) => { if (!o) setDeleteLoan(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete loan application?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteLoan?.full_name || deleteLoan?.email}</strong>'s
              loan ({deleteLoan?.status}) for K{Number(deleteLoan?.loan_amount || 0).toLocaleString()}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(deleteLoan); }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
