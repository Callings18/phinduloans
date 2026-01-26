import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  MessageSquare, 
  Mail, 
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NotificationProviderSettings {
  // Twilio Settings (unified provider)
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  twilio_whatsapp_number: string;
  twilio_messaging_service_sid: string;
  
  // SendGrid (Twilio Email)
  sendgrid_api_key: string;
  sendgrid_from_email: string;
  sendgrid_from_name: string;
  
  // Channel enablement
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  
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
  // Twilio
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_phone_number: "",
  twilio_whatsapp_number: "",
  twilio_messaging_service_sid: "",
  
  // SendGrid
  sendgrid_api_key: "",
  sendgrid_from_email: "",
  sendgrid_from_name: "Phindu Finance",
  
  // Channels
  sms_enabled: false,
  whatsapp_enabled: false,
  email_enabled: false,
  
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
  const [testEmail, setTestEmail] = useState("");

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

  const testChannel = async (channel: 'sms' | 'whatsapp' | 'email') => {
    const recipient = channel === 'email' ? testEmail : testPhone;
    
    if (!recipient) {
      toast({
        title: "Missing Recipient",
        description: `Please enter a ${channel === 'email' ? 'email address' : 'phone number'} to test`,
        variant: "destructive",
      });
      return;
    }

    setTestingChannel(channel);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: channel,
          to: recipient,
          message: `Test ${channel.toUpperCase()} from Phindu Finance notification system. Time: ${new Date().toLocaleString()}`,
          subject: channel === 'email' ? "Test Email from Phindu Finance" : undefined,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send");
      
      toast({
        title: `${channel.toUpperCase()} Test Successful`,
        description: `Test message sent to ${recipient}`,
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

  const getChannelStatus = () => {
    const configured = settings.twilio_account_sid && settings.twilio_auth_token;
    return {
      sms: configured && settings.twilio_phone_number,
      whatsapp: configured && settings.twilio_whatsapp_number,
      email: settings.sendgrid_api_key && settings.sendgrid_from_email,
    };
  };

  const channelStatus = getChannelStatus();

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
            Twilio Notification System
          </CardTitle>
          <CardDescription>
            All notifications (SMS, WhatsApp, Email) are powered by Twilio for reliability and global reach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant={channelStatus.sms ? "default" : "secondary"} className="gap-1">
              <Phone className="h-3 w-3" />
              SMS {channelStatus.sms ? "Ready" : "Not Configured"}
            </Badge>
            <Badge variant={channelStatus.whatsapp ? "default" : "secondary"} className="gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp {channelStatus.whatsapp ? "Ready" : "Not Configured"}
            </Badge>
            <Badge variant={channelStatus.email ? "default" : "secondary"} className="gap-1">
              <Mail className="h-3 w-3" />
              Email {channelStatus.email ? "Ready" : "Not Configured"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="twilio" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="twilio">
            <Settings2 className="h-4 w-4 mr-2" />
            Twilio Config
          </TabsTrigger>
          <TabsTrigger value="channels">
            <Zap className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="events">
            <Bell className="h-4 w-4 mr-2" />
            Event Triggers
          </TabsTrigger>
        </TabsList>

        {/* Twilio Configuration */}
        <TabsContent value="twilio">
          <div className="space-y-6">
            {/* Twilio Core Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Twilio SMS & WhatsApp
                </CardTitle>
                <CardDescription>
                  Configure your Twilio account for SMS and WhatsApp messaging
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilio_account_sid}
                      onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Found in your Twilio Console dashboard</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input
                      type="password"
                      placeholder="Your auth token"
                      value={settings.twilio_auth_token}
                      onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Keep this secret - never share publicly</p>
                  </div>
                  <div className="space-y-2">
                    <Label>SMS Phone Number</Label>
                    <Input
                      type="text"
                      placeholder="+1234567890"
                      value={settings.twilio_phone_number}
                      onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Your Twilio phone number for SMS</p>
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp Number</Label>
                    <Input
                      type="text"
                      placeholder="whatsapp:+14155238886"
                      value={settings.twilio_whatsapp_number}
                      onChange={(e) => setSettings({ ...settings, twilio_whatsapp_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Include "whatsapp:" prefix</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Messaging Service SID (Optional)</Label>
                    <Input
                      type="text"
                      placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilio_messaging_service_sid}
                      onChange={(e) => setSettings({ ...settings, twilio_messaging_service_sid: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Use if you have a Twilio Messaging Service configured</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SendGrid Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Twilio SendGrid Email
                </CardTitle>
                <CardDescription>
                  Configure SendGrid (Twilio's email service) for email notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>SendGrid API Key</Label>
                    <Input
                      type="password"
                      placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.sendgrid_api_key}
                      onChange={(e) => setSettings({ ...settings, sendgrid_api_key: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Create at sendgrid.com → Settings → API Keys</p>
                  </div>
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input
                      type="email"
                      placeholder="noreply@phindu.com"
                      value={settings.sendgrid_from_email}
                      onChange={(e) => setSettings({ ...settings, sendgrid_from_email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Must be verified in SendGrid</p>
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input
                      type="text"
                      placeholder="Phindu Finance"
                      value={settings.sendgrid_from_name}
                      onChange={(e) => setSettings({ ...settings, sendgrid_from_name: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Channel Enablement & Testing */}
        <TabsContent value="channels">
          <Card>
            <CardHeader>
              <CardTitle>Enable & Test Channels</CardTitle>
              <CardDescription>
                Enable notification channels and test they're working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Recipients */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Test Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+260977123456"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Test Email Address</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* SMS Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${settings.sms_enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Phone className={`h-5 w-5 ${settings.sms_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <Label className="font-medium">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send text messages via Twilio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testChannel('sms')}
                    disabled={!settings.sms_enabled || testingChannel === 'sms' || !channelStatus.sms}
                  >
                    {testingChannel === 'sms' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Test
                  </Button>
                  <Switch
                    checked={settings.sms_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, sms_enabled: checked })}
                    disabled={!channelStatus.sms}
                  />
                </div>
              </div>

              {/* WhatsApp Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${settings.whatsapp_enabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <MessageSquare className={`h-5 w-5 ${settings.whatsapp_enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <Label className="font-medium">WhatsApp Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send WhatsApp messages via Twilio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testChannel('whatsapp')}
                    disabled={!settings.whatsapp_enabled || testingChannel === 'whatsapp' || !channelStatus.whatsapp}
                  >
                    {testingChannel === 'whatsapp' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Test
                  </Button>
                  <Switch
                    checked={settings.whatsapp_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_enabled: checked })}
                    disabled={!channelStatus.whatsapp}
                  />
                </div>
              </div>

              {/* Email Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${settings.email_enabled ? 'bg-blue-500/10' : 'bg-muted'}`}>
                    <Mail className={`h-5 w-5 ${settings.email_enabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <Label className="font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send emails via Twilio SendGrid</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testChannel('email')}
                    disabled={!settings.email_enabled || testingChannel === 'email' || !channelStatus.email}
                  >
                    {testingChannel === 'email' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Test
                  </Button>
                  <Switch
                    checked={settings.email_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
                    disabled={!channelStatus.email}
                  />
                </div>
              </div>

              {(!channelStatus.sms || !channelStatus.whatsapp || !channelStatus.email) && (
                <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-400">
                    <p className="font-medium">Some channels need configuration</p>
                    <p>Go to "Twilio Config" tab to set up missing credentials.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Triggers */}
        <TabsContent value="events">
          <div className="space-y-6">
            {eventGroups.map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <group.icon className="h-5 w-5 text-primary" />
                    {group.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.events.map((event) => (
                    <div key={event.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <event.icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label className="font-medium cursor-pointer">{event.label}</Label>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings[event.key as keyof NotificationProviderSettings] as boolean}
                        onCheckedChange={(checked) => setSettings({ ...settings, [event.key]: checked })}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setSettings(savedSettings || defaultSettings)}>
          Reset Changes
        </Button>
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Notification Settings
        </Button>
      </div>

      {/* Setup Instructions */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-blue-700 dark:text-blue-400">
            <AlertCircle className="h-5 w-5" />
            Twilio Setup Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
          <p><strong>1. Create Twilio Account:</strong> Sign up at <a href="https://www.twilio.com" target="_blank" rel="noopener" className="underline">twilio.com</a></p>
          <p><strong>2. Get Credentials:</strong> Find Account SID and Auth Token in your Twilio Console dashboard</p>
          <p><strong>3. SMS:</strong> Buy a phone number from Twilio Console → Phone Numbers → Buy a Number</p>
          <p><strong>4. WhatsApp:</strong> Set up WhatsApp sandbox or apply for WhatsApp Business API in Twilio Console</p>
          <p><strong>5. Email:</strong> Create a SendGrid account (owned by Twilio) at <a href="https://sendgrid.com" target="_blank" rel="noopener" className="underline">sendgrid.com</a>, verify sender, and create API key</p>
        </CardContent>
      </Card>
    </div>
  );
};
