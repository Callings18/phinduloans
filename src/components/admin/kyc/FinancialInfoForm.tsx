import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Banknote, CheckCircle, Pencil, Save, Smartphone, Users, X } from "lucide-react";

interface FinancialInfoFormProps {
  borrowerId: string;
  kycInfo: any;
}

const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit"];
const BANK_NAMES = ["Zanaco", "Stanbic Bank", "FNB Zambia", "Standard Chartered", "ABSA", "Indo Zambia Bank", "Atlas Mara", "Investrust", "NATSAVE", "Other"];

export default function FinancialInfoForm({ borrowerId, kycInfo }: FinancialInfoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const hasData = !!kycInfo;

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id;
      const { error } = await supabase
        .from("borrower_kyc_info")
        .update({ is_verified: true, verified_by: adminId, verified_at: new Date().toISOString() })
        .eq("borrower_id", borrowerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", borrowerId] });
      toast({ title: "Financial info verified" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_holder_name: form.bank_account_holder_name || null,
        bank_branch: form.bank_branch || null,
        account_type: form.account_type || null,
        airtel_money_number: form.airtel_money_number || null,
        mtn_mobile_money_number: form.mtn_mobile_money_number || null,
        zamtel_kwacha_number: form.zamtel_kwacha_number || null,
        mobile_money_account_name: form.mobile_money_account_name || null,
        nok_full_name: form.nok_full_name || null,
        nok_relationship: form.nok_relationship || null,
        nok_phone: form.nok_phone || null,
        nok_alt_phone: form.nok_alt_phone || null,
        nok_nrc_number: form.nok_nrc_number || null,
        nok_address: form.nok_address || null,
        nok_district: form.nok_district || null,
      };

      if (kycInfo) {
        const { error } = await supabase.from("borrower_kyc_info").update(payload).eq("borrower_id", borrowerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("borrower_kyc_info").insert({ ...payload, borrower_id: borrowerId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", borrowerId] });
      toast({ title: "Financial info saved" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    setForm({
      bank_name: kycInfo?.bank_name || "",
      bank_account_number: kycInfo?.bank_account_number || "",
      bank_account_holder_name: kycInfo?.bank_account_holder_name || "",
      bank_branch: kycInfo?.bank_branch || "",
      account_type: kycInfo?.account_type || "",
      airtel_money_number: kycInfo?.airtel_money_number || "",
      mtn_mobile_money_number: kycInfo?.mtn_mobile_money_number || "",
      zamtel_kwacha_number: kycInfo?.zamtel_kwacha_number || "",
      mobile_money_account_name: kycInfo?.mobile_money_account_name || "",
      nok_full_name: kycInfo?.nok_full_name || "",
      nok_relationship: kycInfo?.nok_relationship || "",
      nok_phone: kycInfo?.nok_phone || "",
      nok_alt_phone: kycInfo?.nok_alt_phone || "",
      nok_nrc_number: kycInfo?.nok_nrc_number || "",
      nok_address: kycInfo?.nok_address || "",
      nok_district: kycInfo?.nok_district || "",
    });
    setEditing(true);
  };

  const F = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Card className={`border-border/50 ${kycInfo?.is_verified ? "bg-emerald-500/5 border-emerald-500/30" : hasData ? "bg-yellow-500/5 border-yellow-500/30" : "bg-muted/30"}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className={kycInfo?.is_verified ? "text-emerald-400" : "text-muted-foreground"} size={18} />
          <h4 className="font-semibold text-foreground">Financial Information & Next of Kin</h4>
          <div className="ml-auto flex items-center gap-2">
            {kycInfo?.is_verified && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle size={12} /> Verified</Badge>
            )}
            {!kycInfo?.is_verified && hasData && !editing && (
              <Button size="sm" className="h-7 text-xs" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                Verify
              </Button>
            )}
            {editing ? (
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save size={12} className="mr-1" /> Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  <X size={12} />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEdit}>
                <Pencil size={12} className="mr-1" /> {hasData ? "Edit" : "Add"}
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            {/* Mobile Money */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Smartphone size={12} /> Mobile Money</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account Name</Label>
                  <Input value={form.mobile_money_account_name} onChange={(e) => F("mobile_money_account_name", e.target.value)} placeholder="Full name on account" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Airtel Money</Label>
                  <Input value={form.airtel_money_number} onChange={(e) => F("airtel_money_number", e.target.value)} placeholder="097XXXXXXX" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MTN MoMo</Label>
                  <Input value={form.mtn_mobile_money_number} onChange={(e) => F("mtn_mobile_money_number", e.target.value)} placeholder="096XXXXXXX" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zamtel Kwacha</Label>
                  <Input value={form.zamtel_kwacha_number} onChange={(e) => F("zamtel_kwacha_number", e.target.value)} placeholder="095XXXXXXX" />
                </div>
              </div>
            </div>
            {/* Bank */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Banknote size={12} /> Bank Account</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bank Name</Label>
                  <Select value={form.bank_name} onValueChange={(v) => F("bank_name", v)}>
                    <SelectTrigger><SelectValue placeholder="Select bank..." /></SelectTrigger>
                    <SelectContent>
                      {BANK_NAMES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={form.bank_account_number} onChange={(e) => F("bank_account_number", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Holder Name</Label>
                  <Input value={form.bank_account_holder_name} onChange={(e) => F("bank_account_holder_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Branch</Label>
                  <Input value={form.bank_branch} onChange={(e) => F("bank_branch", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Type</Label>
                  <Select value={form.account_type} onValueChange={(v) => F("account_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* Next of Kin */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Users size={12} /> Next of Kin</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={form.nok_full_name} onChange={(e) => F("nok_full_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship *</Label>
                  <Input value={form.nok_relationship} onChange={(e) => F("nok_relationship", e.target.value)} placeholder="e.g. Spouse, Parent" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone *</Label>
                  <Input value={form.nok_phone} onChange={(e) => F("nok_phone", e.target.value)} placeholder="097XXXXXXX" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alt Phone</Label>
                  <Input value={form.nok_alt_phone} onChange={(e) => F("nok_alt_phone", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NRC Number</Label>
                  <Input value={form.nok_nrc_number} onChange={(e) => F("nok_nrc_number", e.target.value)} placeholder="123456/78/9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input value={form.nok_address} onChange={(e) => F("nok_address", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">District</Label>
                  <Input value={form.nok_district} onChange={(e) => F("nok_district", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        ) : hasData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(kycInfo.airtel_money_number || kycInfo.mtn_mobile_money_number || kycInfo.zamtel_kwacha_number) && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Smartphone size={12} /> Mobile Money</p>
                {kycInfo.airtel_money_number && <p className="text-sm text-foreground">Airtel: {kycInfo.airtel_money_number}</p>}
                {kycInfo.mtn_mobile_money_number && <p className="text-sm text-foreground">MTN: {kycInfo.mtn_mobile_money_number}</p>}
                {kycInfo.zamtel_kwacha_number && <p className="text-sm text-foreground">Zamtel: {kycInfo.zamtel_kwacha_number}</p>}
                {kycInfo.mobile_money_account_name && <p className="text-xs text-muted-foreground mt-1">Name: {kycInfo.mobile_money_account_name}</p>}
              </div>
            )}
            {kycInfo.bank_name && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Banknote size={12} /> Bank Account</p>
                <p className="text-sm text-foreground">{kycInfo.bank_name} — {kycInfo.bank_account_number}</p>
                <p className="text-xs text-muted-foreground">Holder: {kycInfo.bank_account_holder_name}</p>
                {kycInfo.bank_branch && <p className="text-xs text-muted-foreground">Branch: {kycInfo.bank_branch}</p>}
                <p className="text-xs text-muted-foreground">Type: {kycInfo.account_type}</p>
              </div>
            )}
            {kycInfo.nok_full_name && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30 md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Users size={12} /> Next of Kin</p>
                <p className="text-sm text-foreground">{kycInfo.nok_full_name} ({kycInfo.nok_relationship})</p>
                <p className="text-xs text-muted-foreground">Phone: {kycInfo.nok_phone}{kycInfo.nok_alt_phone ? ` / ${kycInfo.nok_alt_phone}` : ""}</p>
                {kycInfo.nok_nrc_number && <p className="text-xs text-muted-foreground">NRC: {kycInfo.nok_nrc_number}</p>}
                {kycInfo.nok_address && <p className="text-xs text-muted-foreground">Address: {kycInfo.nok_address}</p>}
                {kycInfo.nok_district && <p className="text-xs text-muted-foreground">District: {kycInfo.nok_district}</p>}
              </div>
            )}
            {!kycInfo.airtel_money_number && !kycInfo.mtn_mobile_money_number && !kycInfo.zamtel_kwacha_number && !kycInfo.bank_name && !kycInfo.nok_full_name && (
              <p className="text-sm text-muted-foreground">Financial info record exists but no details filled. Click "Edit" to add.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No financial info yet. Click "Add" to enter bank, mobile money, and next of kin details.</p>
        )}
      </CardContent>
    </Card>
  );
}
