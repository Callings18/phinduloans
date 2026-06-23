import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { 
  Loader2, 
  MessageSquare, 
  Phone, 
  CheckCircle2,
  AlertCircle,
  Send,
  Settings2,
  Zap,
  Bell,
  Shield,
  CreditCard,
  FileText,
  Clock,
  AlertTriangle,
  PartyPopper,
  Megaphone
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";

interface NotificationProviderSettings {
  // Channel enablement
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  
  // SMS Provider Selection
  sms_provider: 'twilio' | 'excitesms';
  
  // Twilio Credentials (editable via Admin)
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_whatsapp_number?: string;
  
  // ExciteSMS Credentials
  excitesms_api_url?: string;
  excitesms_api_token?: string;
  excitesms_sender_id?: string;
  
  // Admin notification recipients
  admin_phone?: string;
  admin_whatsapp?: string;
  
  // Notification Event Triggers - Account & Application
  notify_on_signup: boolean;
  notify_on_application_submitted: boolean;
  notify_on_application_under_review: boolean;
  notify_on_kyc_verification: boolean;
  notify_on_document_request: boolean;
  
  // Notification Event Triggers - Loan Status
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_loan_restructured: boolean;
  notify_on_loan_completion: boolean;
  
  // Notification Event Triggers - Payments
  notify_on_payment_received: boolean;
  notify_on_partial_payment: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_collection_escalation: boolean;
  
  // Notification Event Triggers - Other
  notify_on_statement_available: boolean;
  notify_on_promotion: boolean;
  notify_on_court_case: boolean;
  notify_on_contract_sent: boolean;
}

const defaultSettings: NotificationProviderSettings = {
  // Channels
  sms_enabled: true,
  whatsapp_enabled: true,
  
  // SMS Provider Selection
  sms_provider: 'twilio',
  
  // Twilio Credentials (empty - will fallback to env secrets if not set)
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_phone_number: "",
  twilio_whatsapp_number: "",
  
  // ExciteSMS Credentials (empty - will fallback to env secrets if not set)
  excitesms_api_url: "https://gateway.excitesms.com/api/v3",
  excitesms_api_token: "",
  excitesms_sender_id: "Phindu",
  
  // Admin notification recipients
  admin_phone: "",
  admin_whatsapp: "",
  
  // Events - Account & Application
  notify_on_signup: true,
  notify_on_application_submitted: true,
  notify_on_application_under_review: true,
  notify_on_kyc_verification: true,
  notify_on_document_request: true,
  
  // Events - Loan Status
  notify_on_loan_approval: true,
  notify_on_loan_rejection: true,
  notify_on_disbursement: true,
  notify_on_loan_restructured: true,
  notify_on_loan_completion: true,
  
  // Events - Payments
  notify_on_payment_received: true,
  notify_on_partial_payment: true,
  notify_on_payment_reminder: true,
  notify_on_overdue: true,
  notify_on_collection_escalation: true,
  
  // Events - Other
  notify_on_statement_available: true,
  notify_on_promotion: false,
  notify_on_court_case: true,
  notify_on_contract_sent: true,
};

const eventGroups = [
  {
    title: "Account & Application",
    icon: FileText,
    events: [
      { key: "notify_on_signup", label: "New Account Sign Up", description: "Welcome message when borrower creates account", icon: PartyPopper },
      { key: "notify_on_application_submitted", label: "Application Submitted", description: "Confirm loan application received", icon: Send },
      { key: "notify_on_application_under_review", label: "Application Under Review", description: "Notify when application is being reviewed", icon: Clock },
      { key: "notify_on_kyc_verification", label: "KYC Verification", description: "Identity verification status updates", icon: Shield },
      { key: "notify_on_document_request", label: "Document Request", description: "Request additional documents from borrower", icon: FileText },
    ]
  },
  {
    title: "Loan Status",
    icon: CreditCard,
    events: [
      { key: "notify_on_loan_approval", label: "Loan Approval", description: "Notify when loan is approved", icon: CheckCircle2 },
      { key: "notify_on_loan_rejection", label: "Loan Rejection", description: "Notify when loan is rejected", icon: AlertCircle },
      { key: "notify_on_disbursement", label: "Loan Disbursement", description: "Confirm funds have been sent", icon: Zap },
      { key: "notify_on_loan_restructured", label: "Loan Restructured", description: "Notify when loan terms are modified", icon: Settings2 },
      { key: "notify_on_loan_completion", label: "Loan Completion", description: "Congratulate on full repayment", icon: PartyPopper },
      { key: "notify_on_contract_sent", label: "Contract Sent", description: "Notify when loan contract is sent", icon: FileText },
    ]
  },
  {
    title: "Payments & Collections",
    icon: CreditCard,
    events: [
      { key: "notify_on_payment_received", label: "Payment Received", description: "Confirm receipt of full payment", icon: CheckCircle2 },
      { key: "notify_on_partial_payment", label: "Partial Payment", description: "Confirm receipt of partial payment", icon: CreditCard },
      { key: "notify_on_payment_reminder", label: "Payment Reminder", description: "Remind of upcoming payment due", icon: Bell },
      { key: "notify_on_overdue", label: "Overdue Notice", description: "Alert for missed payment", icon: AlertTriangle },
      { key: "notify_on_collection_escalation", label: "Collection Escalation", description: "Warn of escalating collection actions", icon: AlertCircle },
      { key: "notify_on_court_case", label: "Court Case Notice", description: "Notify when legal action is taken", icon: AlertTriangle },
    ]
  },
  {
    title: "Other",
    icon: Megaphone,
    events: [
      { key: "notify_on_statement_available", label: "Statement Available", description: "Monthly/periodic statement ready", icon: FileText },
      { key: "notify_on_promotion", label: "Promotions & Offers", description: "Marketing messages and special offers", icon: Megaphone },
    ]
  }
];

export const NotificationProvidersSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationProviderSettings>(defaultSettings);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  

  // Fetch existing settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["notification-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "notification_providers")
        .maybeSingle();

      if (error) throw error;
      if (!data?.value) return null;
      return data.value as unknown as NotificationProviderSettings;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
  }, [savedSettings]);

  const saveSettings = useMutation({
    mutationFn: async (newSettings: NotificationProviderSettings) => {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "notification_providers")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ 
            value: JSON.parse(JSON.stringify(newSettings)), 
            updated_at: new Date().toISOString() 
          })
          .eq("key", "notification_providers");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert([{ 
            key: "notification_providers", 
            value: JSON.parse(JSON.stringify(newSettings)),
            description: "Twilio notification settings for SMS, WhatsApp, and Email"
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-providers"] });
      toast({
        title: "Settings Saved",
        description: "Notification settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettings.mutate(settings);
  };

  const testChannel = async (channel: 'sms' | 'whatsapp') => {
    const recipient = testPhone;
    
    if (!recipient) {
      toast({
        title: "Missing Recipient",
        description: `Please enter a phone number to test`,
        variant: "destructive",
      });
      return;
    }

    // Determine which provider will be used for the test
    const smsProviderName = settings.sms_provider === 'excitesms' ? 'ExciteSMS' : 'Twilio';
    const providerName = channel === 'sms' ? smsProviderName : 'Twilio WhatsApp';

    setTestingChannel(channel);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: channel,
          to: recipient,
          message: `Test ${channel.toUpperCase()} from Phindu Finance via ${providerName}. Time: ${new Date().toLocaleString()}`,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send");
      
      toast({
        title: `${channel.toUpperCase()} Test Successful`,
        description: `Test message sent to ${recipient} via ${providerName}`,
      });
    } catch (error: any) {
      toast({
        title: `${channel.toUpperCase()} Test Failed`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingChannel(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Status Overview */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Notification System
          </CardTitle>
          <CardDescription>
            SMS via Twilio or ExciteSMS, WhatsApp via Twilio. Configure providers in the Credentials tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant={settings.sms_enabled ? "default" : "secondary"} className="gap-1">
              <Phone className="h-3 w-3" />
              SMS {settings.sms_enabled ? `(${settings.sms_provider === 'excitesms' ? 'ExciteSMS' : 'Twilio'})` : "Disabled"}
            </Badge>
            <Badge variant={settings.whatsapp_enabled ? "default" : "secondary"} className="gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp {settings.whatsapp_enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>


      <Tabs defaultValue="channels" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">
            <Zap className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="credentials">
            <Shield className="h-4 w-4 mr-2" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="events">
            <Bell className="h-4 w-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="h-4 w-4 mr-2" />
            Test
          </TabsTrigger>
        </TabsList>

        {/* Channel Configuration */}
        <TabsContent value="channels">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Channel Settings
              </CardTitle>
              <CardDescription>
                Enable or disable notification channels. Twilio credentials are configured as secure environment secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SMS */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">SMS Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        Send SMS via {settings.sms_provider === 'excitesms' ? 'ExciteSMS' : 'Twilio'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.sms_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, sms_enabled: checked })}
                  />
                </div>
                
                {/* SMS Provider Selection */}
                {settings.sms_enabled && (
                  <div className="ml-12 space-y-2">
                    <Label htmlFor="sms_provider">SMS Provider</Label>
                    <Select
                      value={settings.sms_provider}
                      onValueChange={(value: 'twilio' | 'excitesms') => setSettings({ ...settings, sms_provider: value })}
                    >
                      <SelectTrigger id="sms_provider" className="w-full md:w-[250px]">
                        <SelectValue placeholder="Select SMS Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="excitesms">ExciteSMS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {settings.sms_provider === 'excitesms' 
                        ? 'Using ExciteSMS gateway for SMS delivery' 
                        : 'Using Twilio for SMS delivery'}
                      {' '}(Can also be set via SMS_PROVIDER env var)
                    </p>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">WhatsApp Notifications</h4>
                    <p className="text-sm text-muted-foreground">Send WhatsApp messages via Twilio</p>
                  </div>
                </div>
                <Switch
                  checked={settings.whatsapp_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_enabled: checked })}
                />
              </div>

              <Separator />
              
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Credentials Management
                </h4>
                <p className="text-sm text-muted-foreground">
                  You can configure Twilio and ExciteSMS credentials in the "Credentials" tab. 
                  Settings are saved to the database and take effect immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials Configuration */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Twilio & ExciteSMS Credentials
              </CardTitle>
              <CardDescription>
                Configure your Twilio and ExciteSMS API credentials. Changes take effect immediately after saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Twilio Section */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2 text-primary">
                  <Phone className="h-4 w-4" />
                  Twilio (SMS & WhatsApp)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twilio_sid">Account SID</Label>
                    <Input
                      id="twilio_sid"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilio_account_sid || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilio_token">Auth Token</Label>
                    <Input
                      id="twilio_token"
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={settings.twilio_auth_token || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilio_phone">SMS Phone Number</Label>
                    <Input
                      id="twilio_phone"
                      placeholder="+15551234567"
                      value={settings.twilio_phone_number || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilio_whatsapp">WhatsApp Number</Label>
                    <Input
                      id="twilio_whatsapp"
                      placeholder="+15551234567"
                      value={settings.twilio_whatsapp_number || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_whatsapp_number: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* ExciteSMS Section */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2 text-primary">
                  <Phone className="h-4 w-4" />
                  ExciteSMS (Alternative SMS Provider)
                </h4>
                <p className="text-sm text-muted-foreground">
                  Configure ExciteSMS as an alternative SMS provider. Select it in the Channels tab or set SMS_PROVIDER=excitesms env var.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="excitesms_api_url">API URL</Label>
                    <Input
                      id="excitesms_api_url"
                      placeholder="https://gateway.excitesms.com/api/v3"
                      value={settings.excitesms_api_url || ""}
                      onChange={(e) => setSettings({ ...settings, excitesms_api_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="excitesms_api_token">API Token</Label>
                    <Input
                      id="excitesms_api_token"
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={settings.excitesms_api_token || ""}
                      onChange={(e) => setSettings({ ...settings, excitesms_api_token: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="excitesms_sender_id">Sender ID</Label>
                    <Input
                      id="excitesms_sender_id"
                      placeholder="Phindu"
                      value={settings.excitesms_sender_id || ""}
                      onChange={(e) => setSettings({ ...settings, excitesms_sender_id: e.target.value })}
                    />
                  </div>
                </div>
                
                {settings.sms_provider === 'excitesms' && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary font-medium">ExciteSMS is currently the active SMS provider</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Admin Notification Recipients */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2 text-primary">
                  <Bell className="h-4 w-4" />
                  Admin Notification Recipients
                </h4>
                <p className="text-sm text-muted-foreground">
                  Configure where admin notifications (e.g., contract signed alerts) are sent.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_phone">Admin Phone (SMS)</Label>
                    <Input
                      id="admin_phone"
                      placeholder="+260977123456"
                      value={settings.admin_phone || ""}
                      onChange={(e) => setSettings({ ...settings, admin_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_whatsapp">Admin WhatsApp</Label>
                    <Input
                      id="admin_whatsapp"
                      placeholder="+260977123456"
                      value={settings.admin_whatsapp || ""}
                      onChange={(e) => setSettings({ ...settings, admin_whatsapp: e.target.value })}
                    />
                  </div>
                </div>
              </div>


              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-warning">
                  <AlertCircle className="h-4 w-4" />
                  Important
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Credentials saved here are stored in the database and override environment secrets. 
                  Leave fields empty to use the default environment secrets. 
                  Changes take effect immediately after saving - no redeployment required.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Environment variables:</strong> SMS_PROVIDER (twilio/excitesms), EXCITESMS_API_URL, EXCITESMS_API_TOKEN, EXCITESMS_SENDER_ID
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Triggers */}
        <TabsContent value="events">
          <div className="space-y-4">
            {eventGroups.map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <group.icon className="h-4 w-4" />
                    {group.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.events.map((event) => (
                      <div key={event.key} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <event.icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={settings[event.key as keyof NotificationProviderSettings] as boolean}
                          onCheckedChange={(checked) => 
                            setSettings({ ...settings, [event.key]: checked })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Test Notifications */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test Notifications
              </CardTitle>
              <CardDescription>
                Send a test notification to verify your configuration is working.
                SMS will use {settings.sms_provider === 'excitesms' ? 'ExciteSMS' : 'Twilio'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Phone */}
              <div className="space-y-3">
                <Label>Test Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="+260977123456"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => testChannel('sms')}
                    disabled={testingChannel === 'sms' || !settings.sms_enabled}
                  >
                    {testingChannel === 'sms' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                    <span className="ml-2">SMS</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => testChannel('whatsapp')}
                    disabled={testingChannel === 'whatsapp' || !settings.whatsapp_enabled}
                  >
                    {testingChannel === 'whatsapp' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    <span className="ml-2">WhatsApp</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};
