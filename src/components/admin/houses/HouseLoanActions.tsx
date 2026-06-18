import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  houseApplyPenalties,
  houseEarlySettlement,
  houseEarlySettlementQuote,
  houseMarkDefaulted,
  houseRestructureLoan,
  houseTopUpLoan,
  houseReloanFromCompleted,
  houseReverseLastPayment,
} from "@/services/repositories/houseWorkflowRepository";
import { useAuth } from "@/hooks/useAuth";
import { calculateLoan } from "@/utils/loanCalculations";
import { PhinduCRBCard } from "@/components/admin/PhinduCRBCard";
import { format } from "date-fns";
import { AlertTriangle, Calculator, RefreshCw, RotateCcw, ShieldAlert, Sparkles, Undo2, History } from "lucide-react";

interface Props {
  loan: any;
  product: any;
  productCode: string;
  onChanged: () => void;
}

const formatK = (n: number) => `K${(n || 0).toLocaleString()}`;

export default function HouseLoanActions({ loan, product, productCode, onChanged }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const status = loan?.status as string;
  const loanId = loan?.id as string;

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, account_name, balance").eq("is_active", true).order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["house-loan-events", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await (supabase.from("loan_status_transitions") as any)
        .select("from_status, to_status, reason_text, created_at, actor_type")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lastPaid } = useQuery({
    queryKey: ["house-last-paid", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, amount, principal_paid, installment_number, paid_date")
        .eq("loan_id", loanId)
        .eq("status", "paid")
        .order("paid_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["house-loan-repayments", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
    queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
    queryClient.invalidateQueries({ queryKey: ["house-loan-events", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-last-paid", loanId] });
    onChanged();
  };

  // Penalties
  const penaltiesMutation = useMutation({
    mutationFn: () => houseApplyPenalties(loanId),
    onSuccess: (total) => {
      toast({ title: "Penalties applied", description: `Total penalties: ${formatK(Number(total))}` });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Default
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [defaultReason, setDefaultReason] = useState("");
  const defaultMutation = useMutation({
    mutationFn: () => houseMarkDefaulted(loanId, defaultReason),
    onSuccess: () => { toast({ title: "Loan marked defaulted" }); setDefaultOpen(false); setDefaultReason(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Early settlement
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAccount, setSettleAccount] = useState("");
  const { data: quote } = useQuery({
    queryKey: ["early-settle-quote", loanId, settleOpen],
    enabled: settleOpen && Boolean(loanId),
    queryFn: () => houseEarlySettlementQuote(loanId),
  });
  const settleMutation = useMutation({
    mutationFn: () => houseEarlySettlement({ loanId, accountId: settleAccount }),
    onSuccess: () => { toast({ title: "Early settlement recorded" }); setSettleOpen(false); setSettleAccount(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Restructure
  const [restrOpen, setRestrOpen] = useState(false);
  const [newTerm, setNewTerm] = useState<number>(Number(loan?.loan_term_months || 0));
  const [newRate, setNewRate] = useState<number>(Number(loan?.interest_rate || product?.interest_rate || 0));
  const [restrReason, setRestrReason] = useState("");

  const restructureCalc = useMemo(() => {
    if (!product || !newTerm) return null;
    return calculateLoan(
      Number(loan?.loan_amount || 0),
      newTerm,
      {
        product_name: product?.name,
        product_code: product?.product_code || productCode,
        pricing_tiers: product?.pricing_tiers,
        interest_rate: Number(newRate),
        interest_period: product?.interest_period,
        interest_type: product?.interest_type,
        processing_fee_percent: product?.processing_fee_percent || 0,
        enforcement_fee_percent: product?.enforcement_fee_percent || 0,
        insurance_percent: product?.insurance_percent || 0,
        vat_percent: product?.vat_percent || 0,
        platform_fee_percent: product?.platform_fee_percent || 0,
        term_unit: product?.term_unit,
      },
      (loan?.term_unit || product?.term_unit || "months") as any,
    );
  }, [loan, product, productCode, newTerm, newRate]);

  const restructureMutation = useMutation({
    mutationFn: () => {
      if (!restructureCalc) throw new Error("Cannot calculate new schedule");
      if (!restrReason.trim()) throw new Error("Reason is required");
      return houseRestructureLoan({
        loanId,
        newTermMonths: newTerm,
        newInterestRate: newRate,
        newMonthlyPayment: restructureCalc.monthlyPayment,
        newTotalRepayment: restructureCalc.totalRepayment,
        termUnit: loan?.term_unit || product?.term_unit || "months",
        loanProductId: loan?.loan_product_id,
        userId: loan?.user_id,
        reason: restrReason,
      });
    },
    onSuccess: () => { toast({ title: "Loan restructured" }); setRestrOpen(false); setRestrReason(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Top-up
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmt, setTopupAmt] = useState<number>(0);
  const [topupTerm, setTopupTerm] = useState<number>(Number(loan?.loan_term_months || 0));
  const [topupAccount, setTopupAccount] = useState("");
  const [topupReason, setTopupReason] = useState("");

  const topupCalc = useMemo(() => {
    if (!product || !topupTerm || !topupAmt) return null;
    return calculateLoan(
      Number(loan?.loan_amount || 0) + Number(topupAmt),
      topupTerm,
      {
        product_name: product?.name,
        product_code: product?.product_code || productCode,
        pricing_tiers: product?.pricing_tiers,
        interest_rate: Number(loan?.interest_rate || product?.interest_rate || 0),
        interest_period: product?.interest_period,
        interest_type: product?.interest_type,
        processing_fee_percent: product?.processing_fee_percent || 0,
        enforcement_fee_percent: product?.enforcement_fee_percent || 0,
        insurance_percent: product?.insurance_percent || 0,
        vat_percent: product?.vat_percent || 0,
        platform_fee_percent: product?.platform_fee_percent || 0,
        term_unit: product?.term_unit,
      },
      (loan?.term_unit || product?.term_unit || "months") as any,
    );
  }, [loan, product, productCode, topupAmt, topupTerm]);

  const topupMutation = useMutation({
    mutationFn: () => {
      if (!topupCalc) throw new Error("Enter top-up amount and term");
      if (!topupAccount) throw new Error("Select funding account");
      if (!topupReason.trim()) throw new Error("Reason is required");
      return houseTopUpLoan({
        loanId,
        additionalPrincipal: topupAmt,
        newTotalRepayment: topupCalc.totalRepayment,
        newMonthlyPayment: topupCalc.monthlyPayment,
        newTermMonths: topupTerm,
        termUnit: loan?.term_unit || product?.term_unit || "months",
        loanProductId: loan?.loan_product_id,
        userId: loan?.user_id,
        fundingAccountId: topupAccount,
        reason: topupReason,
      });
    },
    onSuccess: () => { toast({ title: "Top-up disbursed" }); setTopupOpen(false); setTopupAmt(0); setTopupAccount(""); setTopupReason(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Re-loan
  const [reloanOpen, setReloanOpen] = useState(false);
  const [reloanAmt, setReloanAmt] = useState<number>(Number(loan?.loan_amount || 0));
  const [reloanTerm, setReloanTerm] = useState<number>(Number(loan?.loan_term_months || 0));
  const [reloanReason, setReloanReason] = useState("");

  const reloanCalc = useMemo(() => {
    if (!product || !reloanTerm || !reloanAmt) return null;
    return calculateLoan(
      Number(reloanAmt),
      reloanTerm,
      {
        product_name: product?.name,
        product_code: product?.product_code || productCode,
        pricing_tiers: product?.pricing_tiers,
        interest_rate: Number(product?.interest_rate || 0),
        interest_period: product?.interest_period,
        interest_type: product?.interest_type,
        processing_fee_percent: product?.processing_fee_percent || 0,
        enforcement_fee_percent: product?.enforcement_fee_percent || 0,
        insurance_percent: product?.insurance_percent || 0,
        vat_percent: product?.vat_percent || 0,
        platform_fee_percent: product?.platform_fee_percent || 0,
        term_unit: product?.term_unit,
      },
      (loan?.term_unit || product?.term_unit || "months") as any,
    );
  }, [loan, product, productCode, reloanAmt, reloanTerm]);

  const reloanMutation = useMutation({
    mutationFn: () => {
      if (!reloanCalc) throw new Error("Enter principal and term");
      if (!reloanReason.trim()) throw new Error("Reason is required");
      return houseReloanFromCompleted({
        parentLoanId: loanId,
        newPrincipal: reloanAmt,
        newTermMonths: reloanTerm,
        newMonthlyPayment: reloanCalc.monthlyPayment,
        newTotalRepayment: reloanCalc.totalRepayment,
        termUnit: loan?.term_unit || product?.term_unit || "months",
        reason: reloanReason,
      });
    },
    onSuccess: (newLoanId) => {
      toast({ title: "Re-loan created" });
      setReloanOpen(false);
      invalidate();
      navigate(`/admin/houses/${productCode}/loans/${newLoanId}`);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Reverse payment
  const [revOpen, setRevOpen] = useState(false);
  const [revAccount, setRevAccount] = useState("");
  const [revReason, setRevReason] = useState("");
  const reverseMutation = useMutation({
    mutationFn: () => {
      if (!lastPaid?.id) throw new Error("No paid installment to reverse");
      return houseReverseLastPayment({ repaymentId: lastPaid.id, accountId: revAccount, reason: revReason });
    },
    onSuccess: () => { toast({ title: "Payment reversed" }); setRevOpen(false); setRevAccount(""); setRevReason(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // History
  const [historyOpen, setHistoryOpen] = useState(false);

  const showPenalties = ["active", "disbursed"].includes(status);
  const showSettle = status === "active";
  const showRestructure = ["active", "disbursed"].includes(status);
  const showTopup = status === "active";
  const showReloan = status === "completed";
  const showDefault = ["active", "disbursed"].includes(status);
  const showReverse = isAdmin && Boolean(lastPaid?.id);

  return (
    <Card>
      <CardContent className="pt-4 flex flex-wrap gap-2">
        {showPenalties && (
          <Button size="sm" variant="outline" onClick={() => penaltiesMutation.mutate()} disabled={penaltiesMutation.isPending}>
            <Calculator className="h-3.5 w-3.5 mr-1" /> Apply penalties
          </Button>
        )}

        {showSettle && (
          <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5 mr-1" /> Early settlement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Early settlement quote</DialogTitle>
                <DialogDescription>Pay off the remaining loan in a single transaction.</DialogDescription>
              </DialogHeader>
              {quote && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Outstanding principal</span><strong>{formatK(quote.outstanding_principal)}</strong></div>
                  <div className="flex justify-between"><span>Outstanding interest</span><strong>{formatK(quote.outstanding_interest)}</strong></div>
                  <div className="flex justify-between"><span>Penalties</span><strong>{formatK(quote.total_penalties)}</strong></div>
                  <div className="flex justify-between"><span>Early settlement fee</span><strong>{formatK(quote.early_settlement_fee)}</strong></div>
                  <div className="flex justify-between border-t pt-2 mt-2"><span>Total payoff</span><strong className="text-primary">{formatK(quote.total_payoff_amount)}</strong></div>
                </div>
              )}
              <div className="space-y-2 mt-2">
                <Label>Credit to account</Label>
                <Select value={settleAccount} onValueChange={setSettleAccount}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSettleOpen(false)}>Cancel</Button>
                <Button disabled={!settleAccount || settleMutation.isPending} onClick={() => settleMutation.mutate()}>Settle now</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {showRestructure && (
          <Dialog open={restrOpen} onOpenChange={setRestrOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Restructure</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restructure loan</DialogTitle>
                <DialogDescription>Adjust term and interest. Pending installments will be regenerated.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>New term ({loan?.term_unit || "months"})</Label><Input type="number" value={newTerm} onChange={(e) => setNewTerm(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>New interest rate (%)</Label><Input type="number" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>Reason</Label><Textarea value={restrReason} onChange={(e) => setRestrReason(e.target.value)} /></div>
                {restructureCalc && (
                  <div className="text-sm border-t pt-2 space-y-1">
                    <div className="flex justify-between"><span>New monthly payment</span><strong>{formatK(restructureCalc.monthlyPayment)}</strong></div>
                    <div className="flex justify-between"><span>New total repayment</span><strong>{formatK(restructureCalc.totalRepayment)}</strong></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRestrOpen(false)}>Cancel</Button>
                <Button disabled={restructureMutation.isPending} onClick={() => restructureMutation.mutate()}>Restructure</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {showTopup && (
          <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5 mr-1" /> Top-up</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Top-up loan</DialogTitle>
                <DialogDescription>Increase principal and disburse extra funds from an account.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <PhinduCRBCard
                  userId={loan?.user_id}
                  requestedAmount={Number(loan?.loan_amount || 0) + Number(topupAmt || 0)}
                  excludeLoanId={loanId}
                  compact
                />
                <div className="space-y-1"><Label>Additional principal (ZMW)</Label><Input type="number" value={topupAmt} onChange={(e) => setTopupAmt(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>New total term ({loan?.term_unit || "months"})</Label><Input type="number" value={topupTerm} onChange={(e) => setTopupTerm(Number(e.target.value))} /></div>
                <div className="space-y-1">
                  <Label>Funding account (debited)</Label>
                  <Select value={topupAccount} onValueChange={setTopupAccount}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.account_name} — {formatK(Number(a.balance))}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Reason</Label><Textarea value={topupReason} onChange={(e) => setTopupReason(e.target.value)} /></div>
                {topupCalc && (
                  <div className="text-sm border-t pt-2 space-y-1">
                    <div className="flex justify-between"><span>New principal</span><strong>{formatK(Number(loan?.loan_amount || 0) + topupAmt)}</strong></div>
                    <div className="flex justify-between"><span>New monthly payment</span><strong>{formatK(topupCalc.monthlyPayment)}</strong></div>
                    <div className="flex justify-between"><span>New total repayment</span><strong>{formatK(topupCalc.totalRepayment)}</strong></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTopupOpen(false)}>Cancel</Button>
                <Button disabled={!topupAccount || topupMutation.isPending} onClick={() => topupMutation.mutate()}>Top-up & disburse</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {showReloan && (
          <Dialog open={reloanOpen} onOpenChange={setReloanOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><RotateCcw className="h-3.5 w-3.5 mr-1" /> Re-loan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create re-loan</DialogTitle>
                <DialogDescription>Open a new loan for this completed borrower. It will start as pending for review.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <PhinduCRBCard
                  userId={loan?.user_id}
                  requestedAmount={Number(reloanAmt || 0)}
                  excludeLoanId={loanId}
                  compact
                />
                <div className="space-y-1"><Label>New principal (ZMW)</Label><Input type="number" value={reloanAmt} onChange={(e) => setReloanAmt(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>New term ({loan?.term_unit || product?.term_unit || "months"})</Label><Input type="number" value={reloanTerm} onChange={(e) => setReloanTerm(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>Reason</Label><Textarea value={reloanReason} onChange={(e) => setReloanReason(e.target.value)} /></div>
                {reloanCalc && (
                  <div className="text-sm border-t pt-2 space-y-1">
                    <div className="flex justify-between"><span>Monthly payment</span><strong>{formatK(reloanCalc.monthlyPayment)}</strong></div>
                    <div className="flex justify-between"><span>Total repayment</span><strong>{formatK(reloanCalc.totalRepayment)}</strong></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReloanOpen(false)}>Cancel</Button>
                <Button disabled={reloanMutation.isPending} onClick={() => reloanMutation.mutate()}>Create re-loan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {showReverse && (
          <Dialog open={revOpen} onOpenChange={setRevOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Undo2 className="h-3.5 w-3.5 mr-1" /> Reverse last payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reverse last payment</DialogTitle>
                <DialogDescription>Installment #{lastPaid?.installment_number} of {formatK(Number(lastPaid?.principal_paid || lastPaid?.amount || 0))} will be moved back to pending.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Debit account</Label>
                  <Select value={revAccount} onValueChange={setRevAccount}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Reason</Label><Textarea value={revReason} onChange={(e) => setRevReason(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRevOpen(false)}>Cancel</Button>
                <Button disabled={!revAccount || reverseMutation.isPending} onClick={() => reverseMutation.mutate()} variant="destructive">Reverse</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {showDefault && (
          <Dialog open={defaultOpen} onOpenChange={setDefaultOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Mark defaulted</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Mark loan defaulted</DialogTitle>
                <DialogDescription>This is logged to the audit trail. A reason is required.</DialogDescription>
              </DialogHeader>
              <Textarea value={defaultReason} onChange={(e) => setDefaultReason(e.target.value)} placeholder="Reason for default" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDefaultOpen(false)}>Cancel</Button>
                <Button variant="destructive" disabled={defaultReason.trim().length < 3 || defaultMutation.isPending} onClick={() => defaultMutation.mutate()}>Mark defaulted</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost"><History className="h-3.5 w-3.5 mr-1" /> History</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Loan history</DialogTitle>
              <DialogDescription>Status transitions and key events.</DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-auto space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground">No transitions logged yet.</p>}
              {history.map((h: any, i: number) => (
                <div key={i} className="text-xs border rounded-md p-2">
                  <div className="flex justify-between">
                    <Badge variant="outline">{h.from_status} → {h.to_status}</Badge>
                    <span className="text-muted-foreground">{format(new Date(h.created_at), "dd MMM yyyy HH:mm")}</span>
                  </div>
                  {h.reason_text && <p className="mt-1 text-muted-foreground">{h.reason_text}</p>}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
