import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Progress } from "@phinduloans/shared/components/ui/progress";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@phinduloans/shared/components/ui/alert";
import {
  useExciteSmsBalance,
  useSmsPackageConfig,
  useSmsUsageStats,
  type SmsPackageConfig,
} from "@/hooks/useSmsPackageUsage";
import { AlertTriangle, Loader2, MessageSquare, RefreshCw, Save } from "lucide-react";

type SmsPackageUsageCardProps = {
  /** Smaller layout for admin dashboard home */
  compact?: boolean;
};

export default function SmsPackageUsageCard({ compact = false }: SmsPackageUsageCardProps) {
  const { isAdmin, isStaff } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useSmsPackageConfig();
  const { data: usage, isLoading: usageLoading, refetch: refetchUsage } = useSmsUsageStats(config?.package_start_at);
  const [refreshExcite, setRefreshExcite] = useState(false);
  const {
    data: exciteBalance,
    isFetching: exciteFetching,
    refetch: refetchExcite,
  } = useExciteSmsBalance(refreshExcite);

  const [form, setForm] = useState<SmsPackageConfig | null>(null);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (payload: SmsPackageConfig) => {
      const { data: existing } = await supabase.from("system_settings").select("id").eq("key", "sms_package").maybeSingle();
      const value = {
        provider: payload.provider ?? "excitesms",
        package_size: payload.package_size,
        package_start_at: payload.package_start_at,
        low_balance_threshold: payload.low_balance_threshold ?? 200,
        notes: payload.notes,
      };
      if (existing?.id) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", "sms_package");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert([{ key: "sms_package", value }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "SMS package saved", description: "Usage counts from this package start date." });
      queryClient.invalidateQueries({ queryKey: ["sms-package-config"] });
      queryClient.invalidateQueries({ queryKey: ["sms-usage-stats"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const used = usage?.sms_units_used ?? 0;
  const packageSize = config?.package_size ?? 0;
  const remainingEstimate = packageSize > 0 ? Math.max(packageSize - used, 0) : null;
  const usedPct = packageSize > 0 ? Math.min(100, Math.round((used / packageSize) * 100)) : 0;
  const lowThreshold = config?.low_balance_threshold ?? 200;
  const isLow =
    packageSize > 0 && remainingEstimate !== null && remainingEstimate <= lowThreshold;

  const exciteRemaining = exciteBalance?.success ? exciteBalance.remaining_units : null;

  const periodLabel = useMemo(() => {
    if (!config?.package_start_at) return "All time (set a package start date to match your Excite top-up)";
    try {
      return `Since ${format(new Date(config.package_start_at), "dd MMM yyyy")}`;
    } catch {
      return "Since package start";
    }
  }, [config?.package_start_at]);

  if (!isStaff) return null;

  const loading = configLoading || usageLoading;

  const handleRefreshExcite = () => {
    setRefreshExcite(true);
    void refetchExcite();
  };

  const handleSave = () => {
    if (!form || !isAdmin) return;
    saveMutation.mutate(form);
  };

  const setPackageStartToday = () => {
    if (!form) return;
    setForm({ ...form, package_start_at: new Date().toISOString() });
  };

  return (
    <Card className={compact ? "border-border/50" : undefined}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              ExciteSMS package
            </CardTitle>
            <CardDescription>
              Track SMS used through Phindu vs your purchased bundle — no Excite portal login required.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refetchUsage()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${usageLoading ? "animate-spin" : ""}`} />
              Refresh usage
            </Button>
            {!compact && (
              <Button type="button" variant="outline" size="sm" onClick={handleRefreshExcite} disabled={exciteFetching}>
                {exciteFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Check Excite balance
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading SMS usage…
          </div>
        ) : (
          <>
            {isLow && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Low SMS balance (estimate)</AlertTitle>
                <AlertDescription>
                  About {remainingEstimate?.toLocaleString()} SMS units left on this package ({lowThreshold} alert threshold).
                  Top up ExciteSMS or adjust the package size after renewal.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Package size" value={packageSize > 0 ? packageSize.toLocaleString() : "—"} />
              <Stat label="Used (Phindu)" value={used.toLocaleString()} hint={periodLabel} />
              <Stat
                label="Remaining (est.)"
                value={remainingEstimate !== null ? remainingEstimate.toLocaleString() : "—"}
              />
              <Stat label="Sent messages" value={(usage?.messages_sent ?? 0).toLocaleString()} hint="Successful sends" />
            </div>

            {packageSize > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{usedPct}% of package used</span>
                  <span>
                    {used.toLocaleString()} / {packageSize.toLocaleString()} units
                  </span>
                </div>
                <Progress value={usedPct} className="h-2" />
              </div>
            )}

            {exciteRemaining != null && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Excite live
                </Badge>
                <span>
                  Provider reports <strong>{exciteRemaining.toLocaleString()}</strong> units remaining
                  {exciteBalance?.fetched_at
                    ? ` · ${format(new Date(exciteBalance.fetched_at), "HH:mm dd MMM")}`
                    : ""}
                </span>
              </div>
            )}

            {refreshExcite && exciteBalance && !exciteBalance.success && !compact && (
              <p className="text-xs text-muted-foreground">
                {exciteBalance.message ??
                  "Live Excite balance is not available for this API key yet. Package + Phindu usage above is your dashboard view."}
              </p>
            )}

            {!compact && isAdmin && form && (
              <div className="rounded-lg border border-border/60 p-4 space-y-4 bg-muted/20">
                <p className="text-sm font-medium text-foreground">Package settings</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sms-package-size">Package size (SMS units)</Label>
                    <Input
                      id="sms-package-size"
                      type="number"
                      min={0}
                      value={form.package_size}
                      onChange={(e) => setForm({ ...form, package_size: Number(e.target.value) || 0 })}
                    />
                    <p className="text-[10px] text-muted-foreground">e.g. 2000 when you buy a 2,000 SMS bundle</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sms-package-start">Package start</Label>
                    <Input
                      id="sms-package-start"
                      type="datetime-local"
                      value={
                        form.package_start_at
                          ? format(new Date(form.package_start_at), "yyyy-MM-dd'T'HH:mm")
                          : ""
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          package_start_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={setPackageStartToday}>
                      Reset counter from today (new top-up)
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sms-low-threshold">Low balance alert</Label>
                    <Input
                      id="sms-low-threshold"
                      type="number"
                      min={0}
                      value={form.low_balance_threshold ?? 200}
                      onChange={(e) =>
                        setForm({ ...form, low_balance_threshold: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save package
                </Button>
              </div>
            )}

            {!compact && (
              <p className="text-xs text-muted-foreground">
                Usage counts SMS sent from Phindu only (OTP, notifications, queue). Failed:{" "}
                {(usage?.messages_failed ?? 0).toLocaleString()} · Pending:{" "}
                {(usage?.messages_pending ?? 0).toLocaleString()}.{" "}
                <Link to="/admin/settings" className="text-primary underline">
                  Notification settings
                </Link>
              </p>
            )}

            {compact && (
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/admin/settings">Manage package in Settings → SMS</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-card/80 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{hint}</p> : null}
    </div>
  );
}
