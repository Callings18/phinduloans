/**
 * AdminFeatureFlags — kill-switch panel for super admins to disable risky
 * features instantly in production without a redeploy. Reads/writes the
 * `feature_flags` table; UI components consume flags via `useFeatureFlag`.
 */
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { useFeatureFlags, type FeatureFlagRow } from "@phinduloans/shared/hooks/useFeatureFlags";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

const AdminFeatureFlags = () => {
  const { data: flags, isLoading } = useFeatureFlags();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: next, updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feature-flags"] }),
    onError: (e: Error) =>
      toast({ title: "Could not update flag", description: e.message, variant: "destructive" }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureFlagRow[]>();
    (flags ?? []).forEach((f) => {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    });
    return Array.from(map.entries());
  }, [flags]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Feature flags</h1>
          <p className="text-muted-foreground mt-1">
            Kill-switch panel. Disable a feature instantly if a provider goes down or a bug appears
            — no redeploy required. Only super admins can change these.
          </p>
        </div>

        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              Changes take effect immediately for all users. Flip a flag back on once the underlying
              issue is resolved.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize">{category}</CardTitle>
                <CardDescription>{items.length} flag(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{f.flag_label}</p>
                        <Badge variant={f.is_enabled ? "default" : "outline"}>
                          {f.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      {f.description && (
                        <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{f.flag_key}</p>
                    </div>
                    <Switch
                      checked={f.is_enabled}
                      disabled={toggle.isPending}
                      onCheckedChange={(next) => toggle.mutate({ id: f.id, next })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFeatureFlags;
