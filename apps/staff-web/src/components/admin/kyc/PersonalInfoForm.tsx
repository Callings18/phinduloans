import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { User, Pencil, Save, X } from "lucide-react";

interface PersonalInfoFormProps {
  borrowerId: string;
  profile: {
    full_name?: string | null;
    phone?: string | null;
    nrc_number?: string | null;
    address?: string | null;
    city?: string | null;
  } | null;
}

export default function PersonalInfoForm({ borrowerId, profile }: PersonalInfoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    nrc_number: profile?.nrc_number || "",
    address: profile?.address || "",
    city: profile?.city || "",
  });

  const hasData = profile?.full_name || profile?.phone || profile?.nrc_number;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Full name is required");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name || null,
          phone: form.phone || null,
          nrc_number: form.nrc_number || null,
          address: form.address || null,
          city: form.city || null,
        })
        .eq("id", borrowerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-profile-kyc", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["admin-borrowers"] });
      toast({ title: "Personal information updated" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    setForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      nrc_number: profile?.nrc_number || "",
      address: profile?.address || "",
      city: profile?.city || "",
    });
    setEditing(true);
  };

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="text-muted-foreground" size={18} />
          <h4 className="font-semibold text-foreground">Personal Information</h4>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Borrower's full name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone Number *</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+260 9XX XXX XXX" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NRC Number *</Label>
              <Input value={form.nrc_number} onChange={(e) => setForm(f => ({ ...f, nrc_number: e.target.value }))} placeholder="XXXXXX/XX/X" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Residential Address</Label>
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
            </div>
          </div>
        ) : hasData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile?.full_name && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Full Name</p>
                <p className="text-sm text-foreground">{profile.full_name}</p>
              </div>
            )}
            {profile?.phone && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Phone</p>
                <p className="text-sm text-foreground">{profile.phone}</p>
              </div>
            )}
            {profile?.nrc_number && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">NRC Number</p>
                <p className="text-sm text-foreground">{profile.nrc_number}</p>
              </div>
            )}
            {profile?.city && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1">City</p>
                <p className="text-sm text-foreground">{profile.city}</p>
              </div>
            )}
            {profile?.address && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/30 md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Address</p>
                <p className="text-sm text-foreground">{profile.address}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No personal details yet. Click "Add" to enter.</p>
        )}
      </CardContent>
    </Card>
  );
}
