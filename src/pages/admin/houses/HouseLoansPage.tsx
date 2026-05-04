import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseLoans, useHouseRepayments } from "@/hooks/useHouseData";
import { Search, Plus, Eye, AlertTriangle, Pencil } from "lucide-react";
import PaginationControls from "@/components/common/PaginationControls";
import { format } from "date-fns";
import EditPendingLoanDialog from "@/components/loans/EditPendingLoanDialog";
import { usePermissions } from "@/hooks/usePermissions";

// Statuses that can still be edited (before disbursement)
const EDITABLE_STATUSES = new Set(["pending", "under_review", "pmic_pending", "crb_failed"]);

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
  const { can } = usePermissions();
  const canEditLoans = can("loans", "edit") || can("loans", "update");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editTarget, setEditTarget] = useState<any | null>(null);

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
                        <div className="flex items-center gap-1 justify-end">
                          {canEditLoans && EDITABLE_STATUSES.has(l.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Edit pending loan"
                              onClick={() => setEditTarget(l)}
                            >
                              <Pencil size={14} />
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/admin/houses/${productCode}/loans/${l.id}`}><Eye size={14} /></Link>
                          </Button>
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
        loan={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
      />
    </div>
  );
}
