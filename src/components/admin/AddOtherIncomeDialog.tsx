import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

export function AddOtherIncomeDialog() {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, balance")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recordIncome = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Pick an account to credit");
      if (!amount || amount <= 0) throw new Error("Enter a positive amount");
      if (!source.trim()) throw new Error("Source is required");

      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("id, balance")
        .eq("id", accountId)
        .single();
      if (accErr || !account) throw new Error("Account not found");

      const newBalance = Number(account.balance) + amount;

      const { error: txErr } = await supabase.from("account_transactions").insert({
        account_id: accountId,
        transaction_type: "other_income",
        amount,
        balance_before: Number(account.balance),
        balance_after: newBalance,
        source: source.trim(),
        reference_type: "other_income",
        notes: notes.trim() || null,
      });
      if (txErr) throw txErr;

      const { error: updErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", accountId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["pnl-transactions"] });
      toast({ title: "Other income recorded" });
      setOpen(false);
      setAccountId(""); setAmount(0); setSource(""); setNotes("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles size={16} />
          Other Income
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Other Income</DialogTitle>
          <DialogDescription>Non-loan revenue (fees, services, recoveries) credited to an account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Account to credit</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (ZMW)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Late fees, Application fees, Recovery" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => recordIncome.mutate()} disabled={recordIncome.isPending}>Record income</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddOtherIncomeDialog;
