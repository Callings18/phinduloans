import { useCallback, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@phinduloans/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
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
import { useHouseLoans, useHouseRepayments } from "@/hooks/useHouseData";
import {
  Search,
  Plus,
  Eye,
  AlertTriangle,
  Pencil,
  Trash2,
  Download,
  X,
  ArrowUpDown,
} from "lucide-react";
import PaginationControls from "@/components/common/PaginationControls";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { deleteLoanApplication } from "@phinduloans/shared/services/repositories/coreWritesRepository";
import { toast } from "sonner";

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

type DatePreset = "all" | "today" | "7d" | "30d" | "this_month" | "last_month" | "custom";
type DateField = "due_date" | "created_at" | "disbursed_at";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "name_asc" | "overdue_desc";
type LateBucket = "all" | "on_track" | "1_7" | "8_30" | "30_plus" | "defaulted";

export default function HouseLoansPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans, isLoading } = useHouseLoans(productCode);
  const { data: repayments } = useHouseRepayments(productCode);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lateBucket, setLateBucket] = useState<LateBucket>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateField, setDateField] = useState<DateField>("due_date");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date_asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [deleteLoan, setDeleteLoan] = useState<any>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (loan: any) => {
      if (!loan) throw new Error("No loan selected");
      if (!DELETABLE_STATUSES.has(loan.status)) {
        throw new Error(`Cannot delete a loan in status "${loan.status}".`);
      }
      await deleteLoanApplication(loan.id);
    },
    onSuccess: () => {
      toast.success("Loan deleted");
      queryClient.invalidateQueries({ queryKey: ["house-loans"] });
      queryClient.invalidateQueries({ queryKey: ["house-report-summary"] });
      setDeleteLoan(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Only loans that are still running can be overdue. Completed/rejected/
  // defaulted loans (e.g. a loan that was replaced/reloaned) must never be
  // flagged late even if a stray installment row survives.
  const activeLoanIds = useMemo(() => {
    const set = new Set<string>();
    (loans ?? []).forEach((l: any) => {
      if (["active", "disbursed"].includes(l.status)) set.add(l.id);
    });
    return set;
  }, [loans]);

  // Overdue map: loan_id -> { count, amount, oldestDueDate, daysLate }
  const overdueByLoan = useMemo(() => {
    const map: Record<string, { count: number; amount: number; oldestDueDate: string | null; daysLate: number }> = {};
    (repayments ?? []).forEach((r: any) => {
      if (!activeLoanIds.has(r.loan_id)) return;
      if (r.status === "paid" || r.status === "cancelled") return;
      if (!r.due_date || r.due_date >= todayStr) return;
      const entry = map[r.loan_id] ?? { count: 0, amount: 0, oldestDueDate: null, daysLate: 0 };
      entry.count += 1;
      entry.amount += Number(r.amount || 0);
      entry.oldestDueDate =
        !entry.oldestDueDate || r.due_date < entry.oldestDueDate ? r.due_date : entry.oldestDueDate;
      map[r.loan_id] = entry;
    });
    Object.values(map).forEach((e) => {
      e.daysLate = e.oldestDueDate
        ? Math.max(
            0,
            Math.floor(
              (new Date(todayStr).getTime() - new Date(e.oldestDueDate).getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
        : 0;
    });
    return map;
  }, [repayments, todayStr, activeLoanIds]);

  const nextDueByLoan = useMemo(() => {
    const map: Record<string, { dueDate: string; amount: number; status: string | null }> = {};
    (repayments ?? []).forEach((r: any) => {
      if (!activeLoanIds.has(r.loan_id)) return;
      if (r.status === "paid" || r.status === "cancelled") return;
      if (!r.due_date) return;
      const existing = map[r.loan_id];
      if (!existing || r.due_date < existing.dueDate) {
        map[r.loan_id] = {
          dueDate: r.due_date,
          amount: Number(r.amount || 0),
          status: r.status ?? null,
        };
      }
    });
    return map;
  }, [repayments, activeLoanIds]);

  const getDateValue = useCallback((loan: any, field: DateField): string | null => {
    if (field === "due_date") return nextDueByLoan[loan.id]?.dueDate ?? null;
    return loan[field] ?? null;
  }, [nextDueByLoan]);

  // Date range derived from preset
  const dateRange = useMemo<{ from: string | null; to: string | null }>(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "7d":
        return { from: format(subDays(now, 7), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "30d":
        return { from: format(subDays(now, 30), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "this_month":
        return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
      case "last_month": {
        const lm = subMonths(now, 1);
        return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
      }
      case "custom":
        return { from: customFrom || null, to: customTo || null };
      default:
        return { from: null, to: null };
    }
  }, [datePreset, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (!loans) return [];
    const minA = minAmount ? Number(minAmount) : null;
    const maxA = maxAmount ? Number(maxAmount) : null;
    const q = search.trim().toLowerCase();

    const result = loans.filter((l: any) => {
      // Search
      if (q) {
        const hay = [l.full_name, l.email, l.nrc_number, l.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Status
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      // Late bucket
      const od = overdueByLoan[l.id];
      if (lateBucket !== "all") {
        if (lateBucket === "defaulted" && l.status !== "defaulted") return false;
        if (lateBucket === "on_track") {
          if (od || l.status === "defaulted") return false;
          if (!["active", "disbursed"].includes(l.status)) return false;
        }
        if (lateBucket === "1_7" && !(od && od.daysLate >= 1 && od.daysLate <= 7)) return false;
        if (lateBucket === "8_30" && !(od && od.daysLate >= 8 && od.daysLate <= 30)) return false;
        if (lateBucket === "30_plus" && !(od && od.daysLate > 30)) return false;
      }
      // Date range
      const dVal = getDateValue(l, dateField);
      if (dateRange.from || dateRange.to) {
        if (!dVal) return false;
        const d = dVal.slice(0, 10);
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
      }
      // Amount
      const amt = Number(l.loan_amount || 0);
      if (minA !== null && amt < minA) return false;
      if (maxA !== null && amt > maxA) return false;
      return true;
    });

    // Sort
    const sorted = [...result];
    sorted.sort((a: any, b: any) => {
      switch (sortBy) {
        case "date_asc":
          return (getDateValue(a, dateField) || "9999-12-31").localeCompare(getDateValue(b, dateField) || "9999-12-31");
        case "amount_desc":
          return Number(b.loan_amount || 0) - Number(a.loan_amount || 0);
        case "amount_asc":
          return Number(a.loan_amount || 0) - Number(b.loan_amount || 0);
        case "name_asc":
          return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
        case "overdue_desc":
          return (overdueByLoan[b.id]?.daysLate || 0) - (overdueByLoan[a.id]?.daysLate || 0);
        default:
          return (getDateValue(b, dateField) || "").localeCompare(getDateValue(a, dateField) || "");
      }
    });
    return sorted;
  }, [loans, search, statusFilter, lateBucket, overdueByLoan, dateRange, dateField, minAmount, maxAmount, sortBy, getDateValue]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats over ALL loans
  const totalAmount = (loans ?? []).reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0);
  const activeCount = (loans ?? []).filter((l: any) => ["active", "disbursed"].includes(l.status)).length;
  const overdueCount = Object.keys(overdueByLoan).length;
  const defaultedCount = (loans ?? []).filter((l: any) => l.status === "defaulted").length;
  const onTrackCount = (loans ?? []).filter(
    (l: any) => ["active", "disbursed"].includes(l.status) && !overdueByLoan[l.id],
  ).length;

  const lateBuckets = useMemo(() => {
    let b17 = 0, b830 = 0, b30p = 0;
    Object.values(overdueByLoan).forEach((e) => {
      if (e.daysLate >= 1 && e.daysLate <= 7) b17++;
      else if (e.daysLate <= 30) b830++;
      else b30p++;
    });
    return { b17, b830, b30p };
  }, [overdueByLoan]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (loans ?? []).forEach((l: any) => { map[l.status] = (map[l.status] || 0) + 1; });
    return map;
  }, [loans]);

  // Filtered totals (so user knows the slice they're viewing)
  const filteredTotal = filtered.reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setLateBucket("all");
    setDatePreset("all");
    setDateField("due_date");
    setCustomFrom("");
    setCustomTo("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("date_asc");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search ||
    statusFilter !== "all" ||
    lateBucket !== "all" ||
    datePreset !== "all" ||
    dateField !== "due_date" ||
    minAmount ||
    maxAmount ||
    sortBy !== "date_asc";

  const exportCsv = () => {
    const rows = [
      ["Borrower", "Phone", "NRC", "Amount", "Term", "Status", "Days Late", "Overdue Amount", "Due Date", "Created", "Disbursed"],
      ...filtered.map((l: any) => {
        const od = overdueByLoan[l.id];
        const due = nextDueByLoan[l.id]?.dueDate;
        return [
          l.full_name || l.email || "",
          l.phone || "",
          l.nrc_number || "",
          l.loan_amount || 0,
          `${l.loan_term_months || ""} ${l.term_unit || "months"}`,
          statusConfig[l.status]?.label || l.status,
          od?.daysLate ?? 0,
          od?.amount ?? 0,
          due ? format(new Date(due), "yyyy-MM-dd") : "",
          l.created_at ? format(new Date(l.created_at), "yyyy-MM-dd") : "",
          l.disbursed_at ? format(new Date(l.disbursed_at), "yyyy-MM-dd") : "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productCode}-loans-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Loans</h2>
          <p className="text-sm text-muted-foreground">
            {(loans ?? []).length} total · {activeCount} active ·{" "}
            <span className={overdueCount > 0 ? "text-destructive font-medium" : ""}>{overdueCount} overdue</span>
            {" · "}K{totalAmount.toLocaleString()} portfolio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={14} className="mr-1" /> Export ({filtered.length})
          </Button>
          <Button asChild size="sm">
            <Link to={`/admin/houses/${productCode}/loans/create`}><Plus size={16} className="mr-1" /> Create Loan</Link>
          </Button>
        </div>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">On track</p><p className="text-lg font-bold text-emerald-400">{onTrackCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">1–7 days late</p><p className="text-lg font-bold text-yellow-400">{lateBuckets.b17}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">8–30 days late</p><p className="text-lg font-bold text-orange-400">{lateBuckets.b830}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">30+ days late</p><p className="text-lg font-bold text-red-500">{lateBuckets.b30p}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Defaulted</p><p className="text-lg font-bold text-red-600">{defaultedCount}</p></CardContent></Card>
      </div>

      {/* Health quick filters */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={lateBucket === "all" ? "default" : "outline"} onClick={() => { setLateBucket("all"); setCurrentPage(1); }}>All</Button>
        <Button size="sm" variant={lateBucket === "on_track" ? "default" : "outline"} onClick={() => { setLateBucket("on_track"); setCurrentPage(1); }} className={lateBucket !== "on_track" ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : ""}>On track ({onTrackCount})</Button>
        <Button size="sm" variant={lateBucket === "1_7" ? "default" : "outline"} onClick={() => { setLateBucket("1_7"); setCurrentPage(1); }} className={lateBucket !== "1_7" ? "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10" : ""}>1–7 late ({lateBuckets.b17})</Button>
        <Button size="sm" variant={lateBucket === "8_30" ? "default" : "outline"} onClick={() => { setLateBucket("8_30"); setCurrentPage(1); }} className={lateBucket !== "8_30" ? "border-orange-500/40 text-orange-400 hover:bg-orange-500/10" : ""}>8–30 late ({lateBuckets.b830})</Button>
        <Button size="sm" variant={lateBucket === "30_plus" ? "destructive" : "outline"} onClick={() => { setLateBucket("30_plus"); setCurrentPage(1); }} className={lateBucket !== "30_plus" ? "border-red-500/40 text-red-500 hover:bg-red-500/10" : ""}><AlertTriangle size={12} className="mr-1" />30+ late ({lateBuckets.b30p})</Button>
        <Button size="sm" variant={lateBucket === "defaulted" ? "destructive" : "outline"} onClick={() => { setLateBucket("defaulted"); setCurrentPage(1); }} className={lateBucket !== "defaulted" ? "border-red-600/40 text-red-600 hover:bg-red-600/10" : ""}>Defaulted ({defaultedCount})</Button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}>
          All statuses ({(loans ?? []).length})
        </Button>
        {Object.entries(statusCounts).sort().map(([status, count]) => (
          <Button key={status} size="sm" variant={statusFilter === status ? "default" : "outline"} onClick={() => { setStatusFilter(status); setCurrentPage(1); }}>
            {statusConfig[status]?.label || status} ({count})
          </Button>
        ))}
      </div>

      {/* Filters bar */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input placeholder="Search name, NRC, phone..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9 h-9" />
            </div>

            <div className="md:col-span-2">
              <Select value={dateField} onValueChange={(v: DateField) => { setDateField(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Due date</SelectItem>
                  <SelectItem value="created_at">Created date</SelectItem>
                  <SelectItem value="disbursed_at">Disbursed date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select value={datePreset} onValueChange={(v: DatePreset) => { setDatePreset(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any date</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Input type="number" placeholder="Min K" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }} className="h-9" />
            </div>
            <div className="md:col-span-2">
              <Input type="number" placeholder="Max K" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setCurrentPage(1); }} className="h-9" />
            </div>
          </div>

          {datePreset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setCurrentPage(1); }} className="h-9" />
              <Input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setCurrentPage(1); }} className="h-9" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_asc">Earliest date first</SelectItem>
                  <SelectItem value="date_desc">Latest date first</SelectItem>
                  <SelectItem value="amount_desc">Amount (high → low)</SelectItem>
                  <SelectItem value="amount_asc">Amount (low → high)</SelectItem>
                  <SelectItem value="name_asc">Borrower name (A–Z)</SelectItem>
                  <SelectItem value="overdue_desc">Most overdue first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Showing <strong className="text-foreground">{filtered.length}</strong> · K{filteredTotal.toLocaleString()}</span>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7"><X size={12} className="mr-1" /> Clear</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>{dateField === "due_date" ? "Due Date" : dateField === "disbursed_at" ? "Disbursed" : "Created"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((l: any) => {
                  const cfg = statusConfig[l.status] || statusConfig.pending;
                  const od = overdueByLoan[l.id];
                  const due = nextDueByLoan[l.id];
                  const showDate = getDateValue(l, dateField);
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
                              {od.daysLate} day{od.daysLate === 1 ? "" : "s"} late
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {showDate ? format(new Date(showDate), "dd MMM yyyy") : "—"}
                        {dateField === "due_date" && due?.amount ? (
                          <span className="block text-[10px]">K{due.amount.toLocaleString()}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" variant="ghost" title="View">
                            <Link to={`/admin/houses/${productCode}/loans/${l.id}`}><Eye size={14} /></Link>
                          </Button>
                          {EDITABLE_STATUSES.has(l.status) && (
                            <Button asChild size="sm" variant="ghost" title="Edit">
                              <Link to={`/admin/houses/${productCode}/loans/${l.id}/edit`}><Pencil size={14} /></Link>
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
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No loans match your filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {filtered.length > pageSize && (
        <PaginationControls currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
      )}

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
