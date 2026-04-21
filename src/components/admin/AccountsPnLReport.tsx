import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Download } from "lucide-react";

const formatK = (n: number) =>
  new Intl.NumberFormat("en-ZM", { style: "currency", currency: "ZMW", minimumFractionDigits: 2 }).format(n || 0);

interface Props {
  productCode?: string;
}

export default function AccountsPnLReport({ productCode }: Props) {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [accountId, setAccountId] = useState<string>("all");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active-pnl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["pnl-transactions", from, to, accountId],
    queryFn: async () => {
      let q = supabase
        .from("account_transactions")
        .select("id, account_id, transaction_type, amount, created_at, notes, source, destination, reference_type, reference_id")
        .gte("created_at", `${from}T00:00:00.000Z`)
        .lte("created_at", `${to}T23:59:59.999Z`);
      if (accountId !== "all") q = q.eq("account_id", accountId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["pnl-expenses", from, to, productCode],
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("id, amount, expense_category, vendor_payee, paid_at, branch")
        .eq("status", "paid")
        .gte("paid_at", `${from}T00:00:00.000Z`)
        .lte("paid_at", `${to}T23:59:59.999Z`);
      const { data, error } = await q.order("paid_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: writeoffs = [] } = useQuery({
    queryKey: ["pnl-writeoffs", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_writeoffs")
        .select("id, writeoff_amount, approved_at, recovery_amount")
        .eq("status", "approved")
        .gte("approved_at", `${from}T00:00:00.000Z`)
        .lte("approved_at", `${to}T23:59:59.999Z`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const repaymentIncome = txns
      .filter((t: any) => t.transaction_type === "repayment")
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const otherIncome = txns
      .filter((t: any) => t.transaction_type === "other_income")
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const disbursementsOut = txns
      .filter((t: any) => t.transaction_type === "disbursement")
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const opExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const writeOffsAmt = writeoffs.reduce((s: number, w: any) => s + Number(w.writeoff_amount || 0) - Number(w.recovery_amount || 0), 0);

    const totalIncome = repaymentIncome + otherIncome;
    const totalExpenses = opExpenses + writeOffsAmt;
    const netProfit = totalIncome - totalExpenses;
    return { repaymentIncome, otherIncome, disbursementsOut, opExpenses, writeOffsAmt, totalIncome, totalExpenses, netProfit };
  }, [txns, expenses, writeoffs]);

  const handleExportCsv = () => {
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const accountName = accountId === "all" ? "All accounts" : (accounts.find((a: any) => a.id === accountId)?.account_name ?? accountId);
    const rows: (string | number)[][] = [];
    rows.push(["Profit & Loss Report"]);
    rows.push(["Period", `${from} to ${to}`]);
    rows.push(["Account", accountName]);
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Section", "Line item", "Amount (ZMW)"]);
    rows.push(["Income", "Repayments", totals.repaymentIncome.toFixed(2)]);
    rows.push(["Income", "Other income", totals.otherIncome.toFixed(2)]);
    rows.push(["Income", "Total income", totals.totalIncome.toFixed(2)]);
    rows.push(["Expenses", "Operating expenses", totals.opExpenses.toFixed(2)]);
    rows.push(["Expenses", "Loan write-offs (net)", totals.writeOffsAmt.toFixed(2)]);
    rows.push(["Expenses", "Total expenses", totals.totalExpenses.toFixed(2)]);
    rows.push(["Result", "Net profit", totals.netProfit.toFixed(2)]);
    rows.push(["Memo", "Disbursed in period", totals.disbursementsOut.toFixed(2)]);
    rows.push([]);
    rows.push(["Income breakdown"]);
    rows.push(["Date", "Type", "Source", "Notes", "Amount (ZMW)"]);
    txns
      .filter((t: any) => ["repayment", "other_income"].includes(t.transaction_type))
      .forEach((t: any) => {
        rows.push([
          format(new Date(t.created_at), "yyyy-MM-dd"),
          String(t.transaction_type).replace("_", " "),
          t.source || t.destination || "",
          t.notes || "",
          Number(t.amount || 0).toFixed(2),
        ]);
      });
    rows.push([]);
    rows.push(["Expense breakdown"]);
    rows.push(["Date", "Category", "Vendor / Payee", "Branch", "Amount (ZMW)"]);
    expenses.forEach((e: any) => {
      rows.push([
        e.paid_at ? format(new Date(e.paid_at), "yyyy-MM-dd") : "",
        e.expense_category || "",
        e.vendor_payee || "",
        e.branch || "",
        Number(e.amount || 0).toFixed(2),
      ]);
    });
    writeoffs.forEach((w: any) => {
      rows.push([
        w.approved_at ? format(new Date(w.approved_at), "yyyy-MM-dd") : "",
        "Loan write-off",
        "",
        "",
        (Number(w.writeoff_amount || 0) - Number(w.recovery_amount || 0)).toFixed(2),
      ]);
    });

    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex flex-col justify-end">
          <Button variant="outline" onClick={handleExportCsv} disabled={isLoading}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatK(totals.totalIncome)}</p>
            <p className="text-xs text-muted-foreground">Repayments {formatK(totals.repaymentIncome)} • Other {formatK(totals.otherIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatK(totals.totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">Operating {formatK(totals.opExpenses)} • Write-offs {formatK(totals.writeOffsAmt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totals.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{formatK(totals.netProfit)}</p>
            <p className="text-xs text-muted-foreground">Disbursed in period: {formatK(totals.disbursementsOut)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.filter((t: any) => ["repayment", "other_income"].includes(t.transaction_type)).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{format(new Date(t.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell className="capitalize text-xs">{t.transaction_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs">{t.source || t.destination || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{t.notes || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-green-600">{formatK(Number(t.amount))}</TableCell>
                </TableRow>
              ))}
              {!isLoading && txns.filter((t: any) => ["repayment", "other_income"].includes(t.transaction_type)).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No income in period</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor / Payee</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.paid_at ? format(new Date(e.paid_at), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-xs capitalize">{e.expense_category}</TableCell>
                  <TableCell className="text-xs">{e.vendor_payee}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.branch || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-destructive">{formatK(Number(e.amount))}</TableCell>
                </TableRow>
              ))}
              {writeoffs.map((w: any) => (
                <TableRow key={`w-${w.id}`}>
                  <TableCell className="text-xs">{w.approved_at ? format(new Date(w.approved_at), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-xs">Loan write-off</TableCell>
                  <TableCell className="text-xs text-muted-foreground">—</TableCell>
                  <TableCell className="text-xs text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-sm font-medium text-destructive">{formatK(Number(w.writeoff_amount) - Number(w.recovery_amount || 0))}</TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && writeoffs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No expenses in period</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
