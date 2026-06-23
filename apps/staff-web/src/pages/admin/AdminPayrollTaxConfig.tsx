import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import type { Database } from "@phinduloans/shared/integrations/supabase/types";
import { mapSupabaseError } from "@phinduloans/shared/utils/mapSupabaseError";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Pencil, Plus } from "lucide-react";

type TaxRow = Database["public"]["Tables"]["payroll_tax_config"]["Row"];

const emptyForm = (): Partial<TaxRow> & { id?: string } => ({
  config_type: "general",
  label: "",
  band_min: null,
  band_max: null,
  rate_percent: null,
  employee_rate_percent: null,
  employer_rate_percent: null,
  ceiling_amount: null,
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: null,
  notes: null,
  is_active: true,
});

export default function AdminPayrollTaxConfig() {
  const { can } = usePermissions();
  const canView = can("payroll", "view") || can("payroll", "manage") || can("payroll", "approve");
  const canMutate = can("payroll", "manage");
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TaxRow> & { id?: string }>(() => emptyForm());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payroll-tax-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_tax_config").select("*").order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaxRow[];
    },
    enabled: canView,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<TaxRow> & { id?: string }) => {
      if (!canMutate) throw new Error("Requires payroll:manage");
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("payroll_tax_config").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const insertBody = {
          config_type: rest.config_type || "general",
          label: rest.label ?? "",
          band_min: rest.band_min ?? null,
          band_max: rest.band_max ?? null,
          rate_percent: rest.rate_percent ?? null,
          employee_rate_percent: rest.employee_rate_percent ?? null,
          employer_rate_percent: rest.employer_rate_percent ?? null,
          ceiling_amount: rest.ceiling_amount ?? null,
          effective_from: rest.effective_from || new Date().toISOString().slice(0, 10),
          effective_to: rest.effective_to ?? null,
          notes: rest.notes ?? null,
          is_active: rest.is_active ?? true,
        };
        const { error } = await supabase.from("payroll_tax_config").insert(insertBody);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-tax-config"] });
      toast.success(editing.id ? "Tax config updated" : "Tax config row added");
      setEditorOpen(false);
      setEditing(emptyForm());
    },
    onError: (e: unknown) => toast.error(mapSupabaseError(e, "Could not save tax config")),
  });

  const openNew = () => {
    setEditing(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (row: TaxRow) => {
    setEditing({
      id: row.id,
      config_type: row.config_type,
      label: row.label ?? "",
      band_min: row.band_min,
      band_max: row.band_max,
      rate_percent: row.rate_percent,
      employee_rate_percent: row.employee_rate_percent,
      employer_rate_percent: row.employer_rate_percent,
      ceiling_amount: row.ceiling_amount,
      effective_from: row.effective_from?.slice(0, 10) ?? "",
      effective_to: row.effective_to ? row.effective_to.slice(0, 10) : null,
      notes: row.notes,
      is_active: row.is_active,
    });
    setEditorOpen(true);
  };

  const numOrNull = (v: string): number | null => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = () => {
    upsertMutation.mutate({
      id: editing.id,
      config_type: editing.config_type || "general",
      label: editing.label || null,
      band_min: numOrNull(String(editing.band_min ?? "")),
      band_max: numOrNull(String(editing.band_max ?? "")),
      rate_percent: numOrNull(String(editing.rate_percent ?? "")),
      employee_rate_percent: numOrNull(String(editing.employee_rate_percent ?? "")),
      employer_rate_percent: numOrNull(String(editing.employer_rate_percent ?? "")),
      ceiling_amount: numOrNull(String(editing.ceiling_amount ?? "")),
      effective_from: editing.effective_from || new Date().toISOString().slice(0, 10),
      effective_to: editing.effective_to ? String(editing.effective_to).slice(0, 10) : null,
      notes: editing.notes || null,
      is_active: Boolean(editing.is_active),
    });
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.config_type + (a.label || "")).localeCompare(b.config_type + (b.label || ""))),
    [rows],
  );

  if (!canView) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">You don&apos;t have permission to view payroll tax configuration.</p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-8 px-2" asChild>
              <Link to="/admin/payroll" className="inline-flex items-center gap-1 text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
                Back to payroll
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Payroll tax configuration</h1>
            <p className="text-muted-foreground text-sm">
              PAYE bands, NAPSA/NHIMA rates, relief, and flags used by the payroll engine (`payroll_tax_config`). Changes apply to new runs after you regenerate payroll.
            </p>
          </div>
          {canMutate && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Add row
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active configuration rows</CardTitle>
            <CardDescription>RLS: view with payroll view; insert/update/delete requires payroll manage (or admin).</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No tax config rows. Seed migrations or add rows.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Bands / rates</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.config_type}</TableCell>
                        <TableCell>{r.label ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {r.band_min != null || r.band_max != null
                            ? `${r.band_min ?? "—"} – ${r.band_max ?? "—"}`
                            : r.rate_percent != null
                              ? `${r.rate_percent}%`
                              : r.employee_rate_percent != null
                                ? `EE ${r.employee_rate_percent}% / ER ${r.employer_rate_percent ?? 0}%`
                                : r.ceiling_amount != null
                                  ? `Ceiling ${r.ceiling_amount}`
                                  : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.effective_from?.slice(0, 10)}
                          {r.effective_to ? ` → ${r.effective_to.slice(0, 10)}` : ""}
                        </TableCell>
                        <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-right">
                          {canMutate && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit tax config" : "Add tax config"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>config_type</Label>
                <Input
                  value={editing.config_type ?? ""}
                  onChange={(e) => setEditing({ ...editing, config_type: e.target.value })}
                  placeholder="e.g. general, paye_band, napsa, nhima"
                />
              </div>
              <div className="space-y-1.5">
                <Label>label</Label>
                <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>band_min</Label>
                  <Input
                    type="number"
                    value={editing.band_min ?? ""}
                    onChange={(e) => setEditing({ ...editing, band_min: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>band_max</Label>
                  <Input
                    type="number"
                    value={editing.band_max ?? ""}
                    onChange={(e) => setEditing({ ...editing, band_max: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>rate %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.rate_percent ?? ""}
                    onChange={(e) => setEditing({ ...editing, rate_percent: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>EE %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.employee_rate_percent ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, employee_rate_percent: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ER %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.employer_rate_percent ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, employer_rate_percent: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ceiling_amount</Label>
                <Input
                  type="number"
                  value={editing.ceiling_amount ?? ""}
                  onChange={(e) => setEditing({ ...editing, ceiling_amount: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>effective_from</Label>
                  <Input type="date" value={(editing.effective_from || "").slice(0, 10)} onChange={(e) => setEditing({ ...editing, effective_from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>effective_to (optional)</Label>
                  <Input
                    type="date"
                    value={(editing.effective_to || "").slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, effective_to: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={Boolean(editing.is_active)} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} id="active" />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="space-y-1.5">
                <Label>notes</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canMutate || upsertMutation.isPending}>
                {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
