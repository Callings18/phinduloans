import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Banknote, Smartphone, CheckCircle, Clock, Save, Loader2, Edit2 } from "lucide-react";

const ZAMBIAN_BANKS = [
  "Zanaco", "FNB Zambia", "Stanbic Bank", "Standard Chartered", "Barclays/ABSA",
  "Indo Zambia Bank", "Atlas Mara", "First Alliance Bank", "Access Bank",
  "Bank of China", "Citibank", "Investrust Bank", "AB Bank", "United Bank for Africa",
];

interface Props {
  userId: string;
}

export default function KYCFinancialInfo({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    bank_name: "",
    bank_account_number: "",
    bank_account_holder_name: "",
    bank_branch: "",
    account_type: "savings",
    airtel_money_number: "",
    mtn_mobile_money_number: "",
    zamtel_kwacha_number: "",
    mobile_money_account_name: "",
  });

  const { data: kycInfo, isLoading } = useQuery({
    queryKey: ["borrower-kyc-info", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_kyc_info")
        .select("*")
        .eq("borrower_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (kycInfo) {
      setForm({
        bank_name: kycInfo.bank_name || "",
        bank_account_number: kycInfo.bank_account_number || "",
        bank_account_holder_name: kycInfo.bank_account_holder_name || "",
        bank_branch: kycInfo.bank_branch || "",
        account_type: kycInfo.account_type || "savings",
        airtel_money_number: kycInfo.airtel_money_number || "",
        mtn_mobile_money_number: kycInfo.mtn_mobile_money_number || "",
        zamtel_kwacha_number: kycInfo.zamtel_kwacha_number || "",
        mobile_money_account_name: kycInfo.mobile_money_account_name || "",
      });
    }
  }, [kycInfo]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (kycInfo) {
        const { error } = await supabase
          .from("borrower_kyc_info")
          .update({ ...form, is_verified: false, verified_at: null, verified_by: null })
          .eq("borrower_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("borrower_kyc_info")
          .insert({ borrower_id: userId, ...form });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", userId] });
      setIsEditing(false);
      toast({ title: "Financial information saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const hasMobileMoney = form.airtel_money_number || form.mtn_mobile_money_number || form.zamtel_kwacha_number;
  const hasBankDetails = form.bank_name && form.bank_account_number;
  const isComplete = !!(hasMobileMoney || hasBankDetails);

  const handleField = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  if (isLoading) {
    return <Card className="glass border-border/50"><CardContent className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className={isComplete ? "text-emerald-400" : "text-muted-foreground"} size={20} />
              Financial Information
            </CardTitle>
            <CardDescription>Bank account and mobile money details for disbursement & repayment</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {kycInfo?.is_verified ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
                <CheckCircle size={12} /> Verified
              </Badge>
            ) : isComplete ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1">
                <Clock size={12} /> Pending Review
              </Badge>
            ) : null}
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 size={14} className="mr-1" /> Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mobile Money Section */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Smartphone size={16} className="text-primary" /> Mobile Money (at least one required)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="airtel">Airtel Money Number</Label>
              <Input id="airtel" value={form.airtel_money_number} onChange={e => handleField("airtel_money_number", e.target.value)} disabled={!isEditing} placeholder="097XXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtn">MTN Mobile Money Number</Label>
              <Input id="mtn" value={form.mtn_mobile_money_number} onChange={e => handleField("mtn_mobile_money_number", e.target.value)} disabled={!isEditing} placeholder="096XXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zamtel">Zamtel Kwacha Number</Label>
              <Input id="zamtel" value={form.zamtel_kwacha_number} onChange={e => handleField("zamtel_kwacha_number", e.target.value)} disabled={!isEditing} placeholder="095XXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="momo_name">Account Name (as registered)</Label>
              <Input id="momo_name" value={form.mobile_money_account_name} onChange={e => handleField("mobile_money_account_name", e.target.value)} disabled={!isEditing} placeholder="Must match NRC name" />
            </div>
          </div>
        </div>

        {/* Bank Account Section */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Banknote size={16} className="text-primary" /> Bank Account (optional)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Select value={form.bank_name} onValueChange={v => handleField("bank_name", v)} disabled={!isEditing}>
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>
                  {ZAMBIAN_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input value={form.bank_account_number} onChange={e => handleField("bank_account_number", e.target.value)} disabled={!isEditing} placeholder="Account number" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Holder Name</Label>
              <Input value={form.bank_account_holder_name} onChange={e => handleField("bank_account_holder_name", e.target.value)} disabled={!isEditing} placeholder="Must match NRC name" />
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Input value={form.bank_branch} onChange={e => handleField("bank_branch", e.target.value)} disabled={!isEditing} placeholder="Branch name" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select value={form.account_type} onValueChange={v => handleField("account_type", v)} disabled={!isEditing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsEditing(false); if (kycInfo) setForm({ bank_name: kycInfo.bank_name || "", bank_account_number: kycInfo.bank_account_number || "", bank_account_holder_name: kycInfo.bank_account_holder_name || "", bank_branch: kycInfo.bank_branch || "", account_type: kycInfo.account_type || "savings", airtel_money_number: kycInfo.airtel_money_number || "", mtn_mobile_money_number: kycInfo.mtn_mobile_money_number || "", zamtel_kwacha_number: kycInfo.zamtel_kwacha_number || "", mobile_money_account_name: kycInfo.mobile_money_account_name || "" }); }}>
              Cancel
            </Button>
            <Button variant="hero" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
              Save Financial Info
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
