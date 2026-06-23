import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { UserCheck, Plus, Trash2, CheckCircle, Clock, Save, Loader2, AlertTriangle } from "lucide-react";

const RELATIONSHIPS = ["Friend", "Colleague", "Neighbor", "Business Partner", "Church Member", "Other"];

interface Props {
  userId: string;
}

interface ReferenceForm {
  full_name: string;
  relationship: string;
  phone: string;
  alt_phone: string;
  address: string;
  years_known: string;
  occupation: string;
}

const emptyRef: ReferenceForm = { full_name: "", relationship: "", phone: "", alt_phone: "", address: "", years_known: "", occupation: "" };

export default function KYCReferences({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newRef, setNewRef] = useState<ReferenceForm>({ ...emptyRef });

  const { data: references = [], isLoading } = useQuery({
    queryKey: ["borrower-references", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_references")
        .select("*")
        .eq("borrower_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const addMutation = useMutation({
    mutationFn: async (ref: ReferenceForm) => {
      const { error } = await supabase.from("borrower_references").insert({
        borrower_id: userId,
        full_name: ref.full_name,
        relationship: ref.relationship,
        phone: ref.phone,
        alt_phone: ref.alt_phone || null,
        address: ref.address || null,
        years_known: ref.years_known ? parseInt(ref.years_known) : null,
        occupation: ref.occupation || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", userId] });
      setNewRef({ ...emptyRef });
      setShowAdd(false);
      toast({ title: "Reference added" });
    },
    onError: (e: any) => toast({ title: "Failed to add reference", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("borrower_references").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrower-references", userId] });
      toast({ title: "Reference removed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleField = (field: keyof ReferenceForm, value: string) => setNewRef(p => ({ ...p, [field]: value }));

  const handleAdd = () => {
    if (!newRef.full_name || !newRef.phone || !newRef.relationship) {
      toast({ title: "Please fill required fields", description: "Name, relationship and phone are required", variant: "destructive" });
      return;
    }
    addMutation.mutate(newRef);
  };

  const hasEnough = references.length >= 2;

  if (isLoading) {
    return <Card className="glass border-border/50"><CardContent className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className={hasEnough ? "text-emerald-400" : "text-muted-foreground"} size={20} />
              Personal References
            </CardTitle>
            <CardDescription>Provide at least 2 non-family references (friend, colleague, neighbor)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasEnough ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1">
                <CheckCircle size={12} /> {references.length} Provided
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1">
                <AlertTriangle size={12} /> {references.length}/2 Required
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing references */}
        {references.map((ref) => (
          <div key={ref.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/30 border border-border/50">
            <div>
              <p className="font-medium text-foreground text-sm">{ref.full_name}</p>
              <p className="text-xs text-muted-foreground">{ref.relationship} • {ref.phone}</p>
              {ref.occupation && <p className="text-xs text-muted-foreground">{ref.occupation}</p>}
              {ref.years_known && <p className="text-xs text-muted-foreground">Known for {ref.years_known} years</p>}
              {ref.is_verified ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1 mt-1" ><CheckCircle size={10} /> Verified</Badge>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border gap-1 mt-1"><Clock size={10} /> Pending</Badge>
              )}
            </div>
            {!ref.is_verified && (
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(ref.id)} disabled={deleteMutation.isPending}>
                <Trash2 size={14} className="text-destructive" />
              </Button>
            )}
          </div>
        ))}

        {/* Add new reference */}
        {showAdd ? (
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Add Reference</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={newRef.full_name} onChange={e => handleField("full_name", e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relationship *</Label>
                <Select value={newRef.relationship} onValueChange={v => handleField("relationship", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input value={newRef.phone} onChange={e => handleField("phone", e.target.value)} placeholder="+260 9XX XXX XXX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alternative Phone</Label>
                <Input value={newRef.alt_phone} onChange={e => handleField("alt_phone", e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Occupation</Label>
                <Input value={newRef.occupation} onChange={e => handleField("occupation", e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Years Known</Label>
                <Input type="number" value={newRef.years_known} onChange={e => handleField("years_known", e.target.value)} placeholder="e.g. 5" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input value={newRef.address} onChange={e => handleField("address", e.target.value)} placeholder="Physical address" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setNewRef({ ...emptyRef }); }}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                Save Reference
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-2" /> Add Reference
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
