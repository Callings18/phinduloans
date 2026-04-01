import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import GuidedTour from "@/components/common/GuidedTour";
import { Step } from "react-joyride";
import { HelpCircle } from "lucide-react";
import {
  CreditCard,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Settings as SettingsIcon,
  Globe,
  Building2,
  ShieldCheck,
  BellRing,
  Shield,
  Phone
} from "lucide-react";
import { IntegrationsSettings } from "@/components/admin/IntegrationsSettings";
import { BrevoSettings } from "@/components/admin/BrevoSettings";
import NotificationQueueMonitor from "@/components/admin/NotificationQueueMonitor";
import NotificationSettingsPanel from "@/components/admin/NotificationSettingsPanel";
import { NotificationProvidersSettings } from "@/components/admin/NotificationProvidersSettings";

interface PaymentSettings {
  id: string;
  gateway_name: string;
  api_key: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  environment: string;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Payment Gateway State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // System Settings States
  const [generalConfig, setGeneralConfig] = useState({
    currency: "ZMW",
    country: "ZM",
    date_format: "DD/MM/YYYY"
  });

  const [companyInfo, setCompanyInfo] = useState({
    name: "Phindu Loans",
    address: "Lusaka, Zambia",
    support_email: "info@phindu.com",
    support_phone: "+260 967 713 001",
    tax_id: ""
  });

  const [lendingRules, setLendingRules] = useState({
    default_interest_rate: 15.0,
    max_loan_amount: 50000,
    min_loan_amount: 500,
    late_penalty_percent: 5.0,
    grace_period_days: 3
  });

  const [notificationConfig, setNotificationConfig] = useState({
    email_on_approval: true,
    sms_on_approval: false,
    email_on_disbursement: true,
    sms_on_disbursement: false,
    reminder_days_before: 3,
    sms_provider: "africastalking",
    whatsapp_provider: "twilio",
    email_provider: "gmail",
    africastalking_api_key: "",
    africastalking_username: "",
    twilio_sid: "",
    twilio_token: "",
    twilio_whatsapp_number: "",
    tumeny_api_key: "",
    gmail_app_password: "",
    // ExciteSMS credentials
    excitesms_api_url: "https://gateway.excitesms.com/api/v3",
    excitesms_api_token: "",
    excitesms_sender_id: "Phindu",
  });

  const [paymentFormData, setPaymentFormData] = useState({
    api_key: "",
    webhook_secret: "",
    is_active: false,
    environment: "sandbox",
  });

  const [runTour, setRunTour] = useState(false);

  const tourSteps: Step[] = [
    {
      target: ".tour-settings-header",
      content: "This is the brain of your LMS. Configure how the system behaves here.",
      placement: "bottom",
    },
    {
      target: ".tour-settings-tabs",
      content: "Switch between General, Company, Lending rules, and API settings.",
      placement: "bottom",
    },
    {
      target: ".tour-settings-save",
      content: "Don't forget to save your changes! Updates apply instantly across the platform.",
      placement: "top",
    }
  ];

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payment Settings
      const { data: pData, error: pErr } = await supabase
        .from("payment_gateway_settings")
        .select("*")
        .eq("gateway_name", "lenco")
        .single();
      if (pErr && pErr.code !== "PGRST116") throw pErr;

      if (pData) {
        setPaymentSettings(pData);
        setPaymentFormData({
          api_key: pData.api_key || "",
          webhook_secret: pData.webhook_secret || "",
          is_active: pData.is_active || false,
          environment: pData.environment || "sandbox",
        });
      }

      // 2. Fetch System Settings
      const { data: sData, error: sErr } = await supabase.from("system_settings").select("*");
      if (sErr) throw sErr;

      if (sData) {
        sData.forEach(setting => {
          if (setting.key === 'general_config') setGeneralConfig(setting.value as any);
          if (setting.key === 'company_info') setCompanyInfo(setting.value as any);
          if (setting.key === 'lending_rules') setLendingRules(setting.value as any);
          if (setting.key === 'notification_config') setNotificationConfig(setting.value as any);
        });
      }

    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveSystemSetting = async (key: string, value: any) => {
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw error;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save System Settings
      await saveSystemSetting('general_config', generalConfig);
      await saveSystemSetting('company_info', companyInfo);
      await saveSystemSetting('lending_rules', lendingRules);
      await saveSystemSetting('notification_config', notificationConfig);

      // Save Payment Gateway Settings
      if (paymentSettings) {
        const { error } = await supabase
          .from("payment_gateway_settings")
          .update({
            api_key: paymentFormData.api_key || null,
            webhook_secret: paymentFormData.webhook_secret || null,
            is_active: paymentFormData.is_active,
            environment: paymentFormData.environment,
          })
          .eq("id", paymentSettings.id);

        if (error) throw error;
      }

      toast({ title: "Success", description: "All settings saved successfully" });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <GuidedTour
        steps={tourSteps}
        tourKey="admin-settings"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tour-settings-header">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground mt-1">
                Configure system-wide parameters, company info, and integrations
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                onClick={() => setRunTour(true)}
              >
                <HelpCircle size={14} className="mr-1" />
                Tour
              </Button>
            </div>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="gradient-primary tour-settings-save">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All Changes
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6 tour-settings-tabs">
          <TabsList className="bg-muted/50 p-1 flex-wrap">
            <TabsTrigger value="general" className="gap-2">
              <Globe size={16} /> General
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 size={16} /> Company
            </TabsTrigger>
            <TabsTrigger value="lending" className="gap-2">
              <ShieldCheck size={16} /> Lending
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard size={16} /> Payments
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <BellRing size={16} /> Notifications
            </TabsTrigger>
            <TabsTrigger value="twilio" className="gap-2">
              <Phone size={16} /> Twilio/SendGrid
            </TabsTrigger>
            <TabsTrigger value="brevo" className="gap-2">
              <BellRing size={16} /> Brevo
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <BellRing size={16} /> Queue Monitor
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Shield size={16} /> Integrations
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Global Configuration</CardTitle>
                <CardDescription>Localization and regional preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Select
                      value={generalConfig.currency}
                      onValueChange={(v) => setGeneralConfig({ ...generalConfig, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZMW">ZMW - Zambian Kwacha</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select
                      value={generalConfig.date_format}
                      onValueChange={(v) => setGeneralConfig({ ...generalConfig, date_format: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Settings */}
          <TabsContent value="company">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Company Profile</CardTitle>
                <CardDescription>Details used for reports, emails, and invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      value={companyInfo.name}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax ID / TPIN</Label>
                    <Input
                      value={companyInfo.tax_id}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, tax_id: e.target.value })}
                      placeholder="Enter registration number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input
                      value={companyInfo.support_email}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, support_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Phone</Label>
                    <Input
                      value={companyInfo.support_phone}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, support_phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <Label>Head Office Address</Label>
                    <Textarea
                      value={companyInfo.address}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lending Rules */}
          <TabsContent value="lending">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Lending Parameters</CardTitle>
                <CardDescription>Define global limits and penalty rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Default Interest Rate (%)</Label>
                    <Input
                      type="number"
                      value={lendingRules.default_interest_rate}
                      onChange={(e) => setLendingRules({ ...lendingRules, default_interest_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Loan Amount (K)</Label>
                    <Input
                      type="number"
                      value={lendingRules.min_loan_amount}
                      onChange={(e) => setLendingRules({ ...lendingRules, min_loan_amount: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Loan Amount (K)</Label>
                    <Input
                      type="number"
                      value={lendingRules.max_loan_amount}
                      onChange={(e) => setLendingRules({ ...lendingRules, max_loan_amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="font-semibold mb-4">Late Payment & Penalties</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>One-time Penalty Rate (%)</Label>
                      <Input
                        type="number"
                        value={lendingRules.late_penalty_percent}
                        onChange={(e) => setLendingRules({ ...lendingRules, late_penalty_percent: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Charged on the <strong>principal loan amount</strong> per month overdue</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Grace Period (Days)</Label>
                      <Input
                        type="number"
                        value={lendingRules.grace_period_days}
                        onChange={(e) => setLendingRules({ ...lendingRules, grace_period_days: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Days before penalty is applied</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Gateway */}
          <TabsContent value="payments">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Payment Integrations</CardTitle>
                <CardDescription>Configure LENCO API for disbursements and collections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-base">Environment</Label>
                    <p className="text-sm text-muted-foreground">Switch between test and live modes</p>
                  </div>
                  <Select
                    value={paymentFormData.environment}
                    onValueChange={(v) => setPaymentFormData({ ...paymentFormData, environment: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable LENCO Gateway</Label>
                    <p className="text-sm text-muted-foreground">Use this gateway for transaction processing</p>
                  </div>
                  <Switch
                    checked={paymentFormData.is_active}
                    onCheckedChange={(checked) => setPaymentFormData({ ...paymentFormData, is_active: checked })}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>LENCO API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={paymentFormData.api_key}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, api_key: e.target.value })}
                        placeholder="sk_test_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <div className="relative">
                      <Input
                        type={showWebhookSecret ? "text" : "password"}
                        value={paymentFormData.webhook_secret}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, webhook_secret: e.target.value })}
                        placeholder="whsec_..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showWebhookSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Automated Notifications</CardTitle>
                <CardDescription>Configure when and how borrowers are notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Event Triggers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label>Email on Loan Approval</Label>
                      <Switch
                        checked={notificationConfig.email_on_approval}
                        onCheckedChange={(v) => setNotificationConfig({ ...notificationConfig, email_on_approval: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label>SMS on Loan Approval</Label>
                      <Switch
                        checked={notificationConfig.sms_on_approval}
                        onCheckedChange={(v) => setNotificationConfig({ ...notificationConfig, sms_on_approval: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label>Email on Disbursement</Label>
                      <Switch
                        checked={notificationConfig.email_on_disbursement}
                        onCheckedChange={(v) => setNotificationConfig({ ...notificationConfig, email_on_disbursement: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label>SMS on Disbursement</Label>
                      <Switch
                        checked={notificationConfig.sms_on_disbursement}
                        onCheckedChange={(v) => setNotificationConfig({ ...notificationConfig, sms_on_disbursement: v })}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 space-y-4">
                  <h4 className="font-semibold">Payment Reminders</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Send Reminder Before Due Date (Days)</Label>
                      <Input
                        type="number"
                        value={notificationConfig.reminder_days_before}
                        onChange={(e) => setNotificationConfig({ ...notificationConfig, reminder_days_before: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 space-y-4">
                  <h4 className="font-semibold">Provider Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>SMS Provider</Label>
                      <Select
                        value={notificationConfig.sms_provider}
                        onValueChange={(v) => setNotificationConfig({ ...notificationConfig, sms_provider: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="africastalking">Africa's Talking</SelectItem>
                          <SelectItem value="tumeny">Tumeny</SelectItem>
                          <SelectItem value="twilio">Twilio SMS</SelectItem>
                          <SelectItem value="excitesms">ExciteSMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Provider</Label>
                      <Select
                        value={notificationConfig.whatsapp_provider}
                        onValueChange={(v) => setNotificationConfig({ ...notificationConfig, whatsapp_provider: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                          <SelectItem value="none">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Email Provider</Label>
                      <Select
                        value={notificationConfig.email_provider}
                        onValueChange={(v) => setNotificationConfig({ ...notificationConfig, email_provider: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail (SMTP)</SelectItem>
                          <SelectItem value="none">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* Africa's Talking Credentials */}
                    {notificationConfig.sms_provider === 'africastalking' && (
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                        <Label className="text-sm font-bold uppercase opacity-70">Africa's Talking Credentials</Label>
                        <div className="space-y-2">
                          <Label>Username</Label>
                          <Input
                            value={notificationConfig.africastalking_username}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, africastalking_username: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={notificationConfig.africastalking_api_key}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, africastalking_api_key: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tumeny Credentials */}
                    {notificationConfig.sms_provider === 'tumeny' && (
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                        <Label className="text-sm font-bold uppercase opacity-70">Tumeny Credentials</Label>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={notificationConfig.tumeny_api_key}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, tumeny_api_key: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Twilio Credentials */}
                    {(notificationConfig.sms_provider === 'twilio' || notificationConfig.whatsapp_provider === 'twilio') && (
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                        <Label className="text-sm font-bold uppercase opacity-70">Twilio Credentials</Label>
                        <div className="space-y-2">
                          <Label>Account SID</Label>
                          <Input
                            value={notificationConfig.twilio_sid}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, twilio_sid: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Auth Token</Label>
                          <Input
                            type="password"
                            value={notificationConfig.twilio_token}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, twilio_token: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* ExciteSMS Credentials */}
                    {notificationConfig.sms_provider === 'excitesms' && (
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                        <Label className="text-sm font-bold uppercase opacity-70">ExciteSMS Credentials</Label>
                        <div className="space-y-2">
                          <Label>API URL</Label>
                          <Input
                            placeholder="https://gateway.excitesms.com/api/v3"
                            value={notificationConfig.excitesms_api_url}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, excitesms_api_url: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Token</Label>
                          <Input
                            type="password"
                            placeholder="Your ExciteSMS API token"
                            value={notificationConfig.excitesms_api_token}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, excitesms_api_token: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sender ID</Label>
                          <Input
                            placeholder="Phindu"
                            value={notificationConfig.excitesms_sender_id}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, excitesms_sender_id: e.target.value })}
                          />
                          <p className="text-[10px] text-muted-foreground">The sender ID shown on recipients' phones</p>
                        </div>
                      </div>
                    )}

                    {/* Gmail Credentials */}
                    {notificationConfig.email_provider === 'gmail' && (
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                        <Label className="text-sm font-bold uppercase opacity-70">Gmail SMTP Settings</Label>
                        <div className="space-y-2">
                          <Label>Gmail Address</Label>
                          <Input
                            placeholder="your-email@gmail.com"
                            value={companyInfo.support_email}
                            disabled
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>App Password</Label>
                          <Input
                            type="password"
                            placeholder="xxxx xxxx xxxx xxxx"
                            value={notificationConfig.gmail_app_password}
                            onChange={(e) => setNotificationConfig({ ...notificationConfig, gmail_app_password: e.target.value })}
                          />
                          <p className="text-[10px] text-muted-foreground">Requires 2FA enabled in Google Account</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Twilio/SendGrid Notification Settings */}
          <TabsContent value="twilio">
            <NotificationProvidersSettings />
          </TabsContent>

          {/* Brevo Notification Settings */}
          <TabsContent value="brevo">
            <BrevoSettings />
          </TabsContent>

          {/* Notification Queue Monitor */}
          <TabsContent value="queue">
            <NotificationQueueMonitor />
          </TabsContent>

          {/* Integrations Settings (CRB & Guarantee) */}
          <TabsContent value="integrations">
            <IntegrationsSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;