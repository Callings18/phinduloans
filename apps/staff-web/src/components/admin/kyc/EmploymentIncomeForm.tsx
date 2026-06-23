import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { Briefcase, DollarSign, Pencil, Save, X } from "lucide-react";

interface EmploymentIncomeFormProps {
  borrowerId: string;
  profile: {
    employer_name?: string | null;
    job_title?: string | null;
    employment_type?: string | null;
    years_in_employment?: number | null;
    net_income?: number | null;
    address?: string | null;
    city?: string | null;
  } | null;
}

const EMPLOYMENT_TYPES = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self Employed" },
  { value: "contract", label: "Contract" },
  { value: "casual", label: "Casual" },
  { value: "retired", label: "Retired" },
  { value: "unemployed", label: "Unemployed" },
];

export default function EmploymentIncomeForm({ borrowerId, profile }: EmploymentIncomeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    employer_name: profile?.employer_name || "",
    job_title: profile?.job_title || "",
    employment_type: profile?.employment_type || "",
    years_in_employment: profile?.years_in_employment?.toString() || "",
    net_income: profile?.net_income?.toString() || "",
    address: profile?.address || "",
    city: profile?.city || "",
  });

  const hasData = profile?.employer_name || profile?.job_title || profile?.employment_type || profile?.net_income;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          employer_name: form.employer_name || null,
          job_title: form.job_title || null,
          employment_type: form.employment_type || null,
          years_in_employment: form.years_in_employment ? parseInt(form.years_in_employment) : null,
          net_income: form.net_income ? parseFloat(form.net_income) : null,
          address: form.address || null,
          city: form.city || null,
        })
        .eq("id", borrowerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-profile-kyc", borrowerId] });
      toast({ title: "Employment & Income updated" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    setForm({
      employer_name: profile?.employer_name || "",
      job_title: profile?.job_title || "",
      employment_type: profile?.employment_type || "",
      years_in_employment: profile?.years_in_employment?.toString() || "",
      net_income: profile?.net_income?.toString() || "",
      address: profile?.address || "",
      city: profile?.city || "",
    });
    setEditing(true);
  };

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="text-muted-foreground" size={18} />
          <h4 className="font-semibold text-foreground">Employment & Income</h4>
          <div className="ml-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Employer Name</Label>
              <Input value={form.employer_name} onChange={(e) => setForm(f => ({ ...f, employer_name: e.target.value }))} placeholder="e.g. Zambia Revenue Authority" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Job Title</Label>
              <Input value={form.job_title} onChange={(e) => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. Accountant" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Employment Type</Label>
              <Select value={form.employment_type} onValueChange={(v) => setForm(f => ({ ...f, employment_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Years in Employment</Label>
              <Input type="number" min="0" value={form.years_in_employment} onChange={(e) => setForm(f => ({ ...f, years_in_employment: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Net Income (ZMW)</Label>
              <Input type="number" min="0" value={form.net_income} onChange={(e) => setForm(f => ({ ...f, net_income: e.target.value }))} placeholder="e.g. 5000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
          </div>
        ) : hasData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile?.employer_name && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Employer</p>
                <p className="text-sm text-foreground">{profile.employer_name}</p>
              </div>
            )}
            {profile?.job_title && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Job Title</p>
                <p className="text-sm text-foreground">{profile.job_title}</p>
              </div>
            )}
            {profile?.employment_type && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Employment Type</p>
                <p className="text-sm text-foreground capitalize">{profile.employment_type.replace(/_/g, " ")}</p>
              </div>
            )}
            {profile?.years_in_employment != null && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Years in Employment</p>
                <p className="text-sm text-foreground">{profile.years_in_employment} {profile.years_in_employment === 1 ? "year" : "years"}</p>
              </div>
            )}
            {profile?.net_income != null && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><DollarSign size={12} /> Net Income</p>
                <p className="text-sm text-foreground font-medium">K {Number(profile.net_income).toLocaleString()}</p>
              </div>
            )}
            {profile?.address && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Address</p>
                <p className="text-sm text-foreground">{profile.address}{profile.city ? `, ${profile.city}` : ""}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No employment details yet. Click "Add" to enter.</p>
        )}
      </CardContent>
    </Card>
  );
}
