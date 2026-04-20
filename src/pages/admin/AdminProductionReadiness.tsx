/**
 * AdminProductionReadiness — self-check dashboard surfaced to the client
 * before go-live. Each row queries a real prod signal (active accounts,
 * active products per house, contract templates, company info, secret presence)
 * and shows green/red so the team can verify the launch checklist in-app.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";

type Severity = "ok" | "warn" | "fail";

interface CheckResult {
  id: string;
  category: string;
  label: string;
  description: string;
  severity: Severity;
  detail: string;
  fixHint?: string;
}

const KNOWN_HOUSE_CODES = [
  "SALARY_ADVANCE",
  "SALARY_ADVANCE_STAFF",
  "BUSINESS",
  "COLLATERAL",
  "PAYDAY_SOFT",
  "MARKETEER",
];

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Active funding accounts
  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, account_name, balance, is_active")
    .eq("is_active", true);
  if (accErr) throw accErr;
  const fundedAccounts = (accounts ?? []).filter((a) => Number(a.balance) > 0);
  results.push({
    id: "funding-accounts",
    category: "Finance",
    label: "Active funding accounts",
    description: "At least one active account with a positive balance is required to disburse loans.",
    severity: fundedAccounts.length > 0 ? "ok" : (accounts?.length ? "warn" : "fail"),
    detail: `${accounts?.length ?? 0} active account(s); ${fundedAccounts.length} with funds.`,
    fixHint: "Go to Accounts → add or top up an active account.",
  });

  // 2. Active loan products
  const { data: products, error: prodErr } = await supabase
    .from("loan_products")
    .select("id, name, product_code, is_active")
    .eq("is_active", true);
  if (prodErr) throw prodErr;
  const activeCodes = new Set((products ?? []).map((p) => p.product_code));
  results.push({
    id: "active-products",
    category: "Lending",
    label: "Active loan products",
    description: "Each product house needs at least one active loan product so borrowers can apply.",
    severity: (products?.length ?? 0) > 0 ? "ok" : "fail",
    detail: `${products?.length ?? 0} active product(s).`,
    fixHint: "Go to Loan Products → mark a product as active.",
  });

  // Per-house product coverage
  const missingHouses = KNOWN_HOUSE_CODES.filter((c) => !activeCodes.has(c));
  results.push({
    id: "house-coverage",
    category: "Lending",
    label: "Per-house product coverage",
    description: "Every product house should have its product active so its dashboard works.",
    severity: missingHouses.length === 0 ? "ok" : "warn",
    detail:
      missingHouses.length === 0
        ? "All known product houses have an active product."
        : `Missing active product for: ${missingHouses.join(", ")}`,
    fixHint: "Activate the missing product or hide its house from the sidebar.",
  });

  // 3. Contract templates
  const { data: templates, error: tplErr } = await supabase
    .from("contract_templates")
    .select("id, name, loan_product_id, is_active")
    .eq("is_active", true);
  if (tplErr) throw tplErr;
  const productIdsWithTemplate = new Set(
    (templates ?? []).map((t) => t.loan_product_id).filter(Boolean) as string[],
  );
  const productsMissingTemplate = (products ?? []).filter(
    (p) => !productIdsWithTemplate.has(p.id),
  );
  results.push({
    id: "contract-templates",
    category: "Compliance",
    label: "Contract templates",
    description: "Each active loan product should have at least one active contract template.",
    severity: productsMissingTemplate.length === 0 ? "ok" : "warn",
    detail:
      productsMissingTemplate.length === 0
        ? `${templates?.length ?? 0} active template(s).`
        : `Missing templates for: ${productsMissingTemplate.map((p) => p.name).join(", ")}`,
    fixHint: "Go to Contract templates → upload a template for each product.",
  });

  // 4. Company info populated
  const { data: companyRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "company_info")
    .maybeSingle();
  const company = (companyRow?.value as Record<string, string> | null) ?? null;
  const placeholderRegex = /xxx|placeholder|todo/i;
  const missingCompanyFields: string[] = [];
  if (!company?.name) missingCompanyFields.push("name");
  if (!company?.support_phone || placeholderRegex.test(company.support_phone)) missingCompanyFields.push("phone");
  if (!company?.support_email || placeholderRegex.test(company.support_email)) missingCompanyFields.push("email");
  if (!company?.address || placeholderRegex.test(company.address)) missingCompanyFields.push("address");
  results.push({
    id: "company-info",
    category: "Compliance",
    label: "Company info",
    description: "Used in receipts, contracts, and notifications. No placeholder values in production.",
    severity: missingCompanyFields.length === 0 ? "ok" : "fail",
    detail:
      missingCompanyFields.length === 0
        ? "Name, phone, email, and address are populated."
        : `Missing or placeholder: ${missingCompanyFields.join(", ")}`,
    fixHint: "Go to Settings → Company.",
  });

  // 5. Notification provider config
  const { data: providerRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();
  const provider = (providerRow?.value as Record<string, unknown> | null) ?? null;
  const smsConfigured =
    Boolean((provider?.excitesms_api_token as string) || (provider?.twilio_auth_token as string));
  const emailConfigured = Boolean(
    (provider?.sendgrid_api_key as string) || (provider?.brevo_api_key as string),
  );
  results.push({
    id: "sms-provider",
    category: "Notifications",
    label: "SMS provider configured",
    description: "Required for OTPs and payment reminders.",
    severity: smsConfigured ? "ok" : "fail",
    detail: smsConfigured ? "Token present in notification_providers settings." : "No SMS token saved.",
    fixHint: "Go to Settings → Notifications → add ExciteSMS or Twilio credentials.",
  });
  results.push({
    id: "email-provider",
    category: "Notifications",
    label: "Email provider configured",
    description: "Required for approval letters, statements, and receipts.",
    severity: emailConfigured ? "ok" : "warn",
    detail: emailConfigured ? "Email API key present." : "No email API key saved.",
    fixHint: "Go to Settings → Brevo or SendGrid.",
  });

  // 6. Recent notification health (failed in last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedCount } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since);
  const { count: stuckCount } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
  results.push({
    id: "notification-health",
    category: "Notifications",
    label: "Notification queue health (24h)",
    description: "Stuck >30min or failed notifications indicate provider/cron issues.",
    severity:
      (failedCount ?? 0) === 0 && (stuckCount ?? 0) === 0
        ? "ok"
        : (failedCount ?? 0) > 10 || (stuckCount ?? 0) > 10
          ? "fail"
          : "warn",
    detail: `${failedCount ?? 0} failed, ${stuckCount ?? 0} stuck pending.`,
    fixHint: "Open Settings → Queue Monitor or check provider credentials.",
  });

  // 7. Stuck disbursements
  const { count: stuckDisb } = await supabase
    .from("disbursements")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  results.push({
    id: "stuck-disbursements",
    category: "Finance",
    label: "Stuck disbursements (>24h pending)",
    description: "Pending disbursements older than 24 hours block borrowers from receiving funds.",
    severity: (stuckDisb ?? 0) === 0 ? "ok" : "warn",
    detail: `${stuckDisb ?? 0} disbursement(s) pending over 24h.`,
    fixHint: "Open Disbursements and complete or cancel them.",
  });

  return results;
}

const severityStyles: Record<Severity, { icon: typeof CheckCircle2; tone: string; badge: string; label: string }> = {
  ok: {
    icon: CheckCircle2,
    tone: "text-success",
    badge: "bg-success/15 text-success border-success/30",
    label: "Ready",
  },
  warn: {
    icon: AlertCircle,
    tone: "text-warning",
    badge: "bg-warning/15 text-warning border-warning/30",
    label: "Attention",
  },
  fail: {
    icon: XCircle,
    tone: "text-destructive",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    label: "Blocker",
  },
};

const AdminProductionReadiness = () => {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["production-readiness"],
    queryFn: runChecks,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CheckResult[]>();
    (data ?? []).forEach((c) => {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    });
    return Array.from(map.entries());
  }, [data]);

  const summary = useMemo(() => {
    const counts = { ok: 0, warn: 0, fail: 0 };
    (data ?? []).forEach((c) => {
      counts[c.severity] += 1;
    });
    return counts;
  }, [data]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Production readiness</h1>
            <p className="text-muted-foreground mt-1">
              Live self-check of the operational gates required for go-live.
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-run checks
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ready</p>
              <p className="text-2xl font-bold text-success">{summary.ok}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Attention</p>
              <p className="text-2xl font-bold text-warning">{summary.warn}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Blockers</p>
              <p className="text-2xl font-bold text-destructive">{summary.fail}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>{items.length} check(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((c) => {
                    const s = severityStyles[c.severity];
                    const Icon = s.icon;
                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4"
                      >
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${s.tone}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{c.label}</p>
                            <Badge variant="outline" className={`border ${s.badge}`}>{s.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                          <p className="text-sm text-foreground mt-2 font-medium">{c.detail}</p>
                          {c.severity !== "ok" && c.fixHint && (
                            <p className="text-xs text-muted-foreground mt-1 italic">→ {c.fixHint}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProductionReadiness;
