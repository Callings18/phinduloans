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
import { Users, CheckCircle, Clock, Save, Loader2, Edit2 } from "lucide-react";

const RELATIONSHIPS = ["Parent", "Sibling", "Spouse", "Child", "Uncle", "Aunt", "Cousin", "Grandparent", "Other"];

interface Props {
  userId: string;
}

export default function KYCNextOfKin({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    nok_full_name: "",
    nok_relationship: "",
    nok_nrc_number: "",
    nok_phone: "",
    nok_alt_phone: "",
    nok_address: "",
    nok_district: "",
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
        nok_full_name: kycInfo.nok_full_name || "",
        nok_relationship: kycInfo.nok_relationship || "",
        nok_nrc_number: kycInfo.nok_nrc_number || "",
        nok_phone: kycInfo.nok_phone || "",
        nok_alt_phone: kycInfo.nok_alt_phone || "",
        nok_address: kycInfo.nok_address || "",
        nok_district: kycInfo.nok_district || "",
      });
    }
  }, [kycInfo]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (kycInfo) {
        const { error } = await supabase
          .from("borrower_kyc_info")
          .update(form)
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
      toast({ title: "Next of kin saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const isComplete = !!(form.nok_full_name && form.nok_phone && form.nok_relationship);
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
              <Users className={isComplete ? "text-emerald-400" : "text-muted-foreground"} size={20} />
              Next of Kin
            </CardTitle>
            <CardDescription>Emergency contact — required for all loan applications</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
                <CheckCircle size={12} /> Provided
              </Badge>
            )}
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 size={14} className="mr-1" /> Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={form.nok_full_name} onChange={e => handleField("nok_full_name", e.target.value)} disabled={!isEditing} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Relationship *</Label>
            <Select value={form.nok_relationship} onValueChange={v => handleField("nok_relationship", v)} disabled={!isEditing}>
              <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>NRC Number</Label>
            <Input value={form.nok_nrc_number} onChange={e => handleField("nok_nrc_number", e.target.value)} disabled={!isEditing} placeholder="XXXXXX/XX/X" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input value={form.nok_phone} onChange={e => handleField("nok_phone", e.target.value)} disabled={!isEditing} placeholder="+260 9XX XXX XXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Alternative Phone</Label>
            <Input value={form.nok_alt_phone} onChange={e => handleField("nok_alt_phone", e.target.value)} disabled={!isEditing} placeholder="+260 9XX XXX XXX" />
          </div>
          <div className="space-y-1.5">
            <Label>District</Label>
            <Input value={form.nok_district} onChange={e => handleField("nok_district", e.target.value)} disabled={!isEditing} placeholder="District" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Physical Address</Label>
            <Input value={form.nok_address} onChange={e => handleField("nok_address", e.target.value)} disabled={!isEditing} placeholder="Full address" />
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button variant="hero" onClick={() => {
              if (!form.nok_full_name || !form.nok_phone || !form.nok_relationship) {
                toast({ title: "Please fill required fields", description: "Name, relationship and phone are required", variant: "destructive" });
                return;
              }
              saveMutation.mutate();
            }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
