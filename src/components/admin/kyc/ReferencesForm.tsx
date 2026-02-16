import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Phone, Plus, Save, Trash2, UserCheck, X } from "lucide-react";

interface Reference {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  alt_phone?: string | null;
  occupation?: string | null;
  years_known?: number | null;
  address?: string | null;
  is_verified?: boolean | null;
}

interface ReferencesFormProps {
  borrowerId: string;
  references: Reference[];
}

const EMPTY_REF = { full_name: "", relationship: "", phone: "", alt_phone: "", occupation: "", years_known: "", address: "" };

export default function ReferencesForm({ borrowerId, references }: ReferencesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_REF);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.relationship || !form.phone) throw new Error("Name, relationship, and phone are required");
      const { error } = await supabase.from("borrower_references").insert({
        borrower_id: borrowerId,
        full_name: form.full_name,
        relationship: form.relationship,
        phone: form.phone,
        alt_phone: form.alt_phone || null,
        occupation: form.occupation || null,
        years_known: form.years_known ? parseInt(form.years_known) : null,
        address: form.address || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", borrowerId] });
      toast({ title: "Reference added" });
      setAdding(false);
      setForm(EMPTY_REF);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async (refId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("borrower_references")
        .update({ is_verified: true, verified_by: session?.session?.user?.id, verified_at: new Date().toISOString() })
        .eq("id", refId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", borrowerId] });
      toast({ title: "Reference verified" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (refId: string) => {
      const { error } = await supabase.from("borrower_references").delete().eq("id", refId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", borrowerId] });
      toast({ title: "Reference removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const F = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="text-muted-foreground" size={18} />
          <h4 className="font-semibold text-foreground">Personal References ({references.length})</h4>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => { setAdding(true); setForm(EMPTY_REF); }}>
            <Plus size={12} className="mr-1" /> Add Reference
          </Button>
        </div>

        {adding && (
          <div className="p-3 rounded-lg bg-background/50 border border-primary/30 mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => F("full_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relationship *</Label>
                <Input value={form.relationship} onChange={(e) => F("relationship", e.target.value)} placeholder="e.g. Friend, Colleague" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input value={form.phone} onChange={(e) => F("phone", e.target.value)} placeholder="097XXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alt Phone</Label>
                <Input value={form.alt_phone} onChange={(e) => F("alt_phone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Occupation</Label>
                <Input value={form.occupation} onChange={(e) => F("occupation", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Years Known</Label>
                <Input type="number" min="0" value={form.years_known} onChange={(e) => F("years_known", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input value={form.address} onChange={(e) => F("address", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}><X size={12} className="mr-1" /> Cancel</Button>
              <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                <Save size={12} className="mr-1" /> Save Reference
              </Button>
            </div>
          </div>
        )}

        {references.length > 0 ? (
          <div className="space-y-2">
            {references.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{ref.full_name} ({ref.relationship})</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} /> {ref.phone}{ref.alt_phone ? ` / ${ref.alt_phone}` : ""}</p>
                  {ref.occupation && <p className="text-xs text-muted-foreground">{ref.occupation}</p>}
                  {ref.years_known && <p className="text-xs text-muted-foreground">Known {ref.years_known} years</p>}
                </div>
                <div className="flex items-center gap-2">
                  {ref.is_verified ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle size={12} /> Verified</Badge>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" onClick={() => verifyMutation.mutate(ref.id)} disabled={verifyMutation.isPending}>
                      Verify
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteMutation.mutate(ref.id)} disabled={deleteMutation.isPending}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : !adding ? (
          <p className="text-sm text-muted-foreground">No references yet. Click "Add Reference" to enter.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
