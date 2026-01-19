import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  MessageSquare, 
  Mail, 
  Phone, 
  CheckCircle, 
  AlertCircle,
  Send
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NotificationProviderSettings {
  // SMS Settings
  sms_enabled: boolean;
  sms_provider: "africastalking" | "twilio" | "none";
  africastalking_username: string;
  africastalking_api_key: string;
  africastalking_sender_id: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  
  // WhatsApp Settings
  whatsapp_enabled: boolean;
  whatsapp_provider: "africastalking" | "twilio" | "respondio" | "none";
  africastalking_whatsapp_number: string;
  twilio_whatsapp_number: string;
  respondio_api_key: string;
  respondio_base_url: string;
  respondio_whatsapp_channel_id: string;
  
  // Email Settings
  email_enabled: boolean;
  email_provider: "sendgrid" | "smtp" | "none";
  sendgrid_api_key: string;
  sendgrid_from_email: string;
  sendgrid_from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  
  // Notification Preferences
  notify_on_signup: boolean;
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_payment_received: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_loan_completion: boolean;
}

const defaultSettings: NotificationProviderSettings = {
  sms_enabled: false,
  sms_provider: "none",
  africastalking_username: "",
  africastalking_api_key: "",
  africastalking_sender_id: "PHINDU",
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_phone_number: "",
  
  whatsapp_enabled: false,
  whatsapp_provider: "none",
  africastalking_whatsapp_number: "",
  twilio_whatsapp_number: "",
  respondio_api_key: "",
  respondio_base_url: "https://api.respond.io/v3",
  respondio_whatsapp_channel_id: "",
  
  email_enabled: false,
  email_provider: "none",
  sendgrid_api_key: "",
  sendgrid_from_email: "",
  sendgrid_from_name: "Phindu Finance",
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_from_email: "",
  smtp_from_name: "Phindu Finance",
  
  notify_on_signup: true,
  notify_on_loan_approval: true,
  notify_on_loan_rejection: true,
  notify_on_disbursement: true,
  notify_on_payment_received: true,
  notify_on_payment_reminder: true,
  notify_on_overdue: true,
  notify_on_loan_completion: true,
};

export const NotificationProvidersSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationProviderSettings>(defaultSettings);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

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
            description: "Notification provider settings for SMS, WhatsApp, and Email"
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-providers"] });
      toast({
        title: "Settings Saved",
        description: "Notification provider settings have been updated successfully.",
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

  const testSMSProvider = async () => {
    setTestingProvider("sms");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "sms",
          to: "+260000000000", // Test number
          message: "Test SMS from Phindu Finance notification system",
          provider: settings.sms_provider,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "SMS Test Successful",
        description: `Test message sent via ${settings.sms_provider}`,
      });
    } catch (error: any) {
      toast({
        title: "SMS Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const testWhatsAppProvider = async () => {
    setTestingProvider("whatsapp");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "whatsapp",
          to: "+260000000000", // Test number
          message: "Test WhatsApp message from Phindu Finance notification system",
          provider: settings.whatsapp_provider,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "WhatsApp Test Successful",
        description: `Test message sent via ${settings.whatsapp_provider}`,
      });
    } catch (error: any) {
      toast({
        title: "WhatsApp Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const testEmailProvider = async () => {
    setTestingProvider("email");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "email",
          to: "test@example.com", // Test email
          subject: "Test Email",
          message: "Test email from Phindu Finance notification system",
          provider: settings.email_provider,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Email Test Successful",
        description: `Test email sent via ${settings.email_provider}`,
      });
    } catch (error: any) {
      toast({
        title: "Email Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
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
      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sms">
            <Phone className="h-4 w-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Send className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* SMS Configuration */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                SMS Notifications
              </CardTitle>
              <CardDescription>
                Configure SMS providers for sending text messages to borrowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send SMS notifications to borrowers
                  </p>
                </div>
                <Switch
                  checked={settings.sms_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, sms_enabled: checked })
                  }
                />
              </div>

              {settings.sms_enabled && (
                <>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>SMS Provider</Label>
                    <Select
                      value={settings.sms_provider}
                      onValueChange={(value: any) => 
                        setSettings({ ...settings, sms_provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="africastalking">Africa's Talking</SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="none">None (Disabled)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.sms_provider === "africastalking" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Africa's Talking Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Username</Label>
                          <Input
                            type="text"
                            placeholder="sandbox or your username"
                            value={settings.africastalking_username}
                            onChange={(e) => 
                              setSettings({ ...settings, africastalking_username: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            placeholder="Your API key"
                            value={settings.africastalking_api_key}
                            onChange={(e) => 
                              setSettings({ ...settings, africastalking_api_key: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sender ID</Label>
                          <Input
                            type="text"
                            placeholder="PHINDU"
                            value={settings.africastalking_sender_id}
                            onChange={(e) => 
                              setSettings({ ...settings, africastalking_sender_id: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.sms_provider === "twilio" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Twilio Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Account SID</Label>
                          <Input
                            type="text"
                            placeholder="ACxxxxxxxxxxxxx"
                            value={settings.twilio_account_sid}
                            onChange={(e) => 
                              setSettings({ ...settings, twilio_account_sid: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Auth Token</Label>
                          <Input
                            type="password"
                            placeholder="Your auth token"
                            value={settings.twilio_auth_token}
                            onChange={(e) => 
                              setSettings({ ...settings, twilio_auth_token: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Twilio Phone Number</Label>
                          <Input
                            type="text"
                            placeholder="+1234567890"
                            value={settings.twilio_phone_number}
                            onChange={(e) => 
                              setSettings({ ...settings, twilio_phone_number: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.sms_provider !== "none" && (
                    <Button 
                      variant="outline" 
                      onClick={testSMSProvider}
                      disabled={testingProvider === "sms"}
                    >
                      {testingProvider === "sms" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Test SMS Connection
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Configuration */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp Notifications
              </CardTitle>
              <CardDescription>
                Configure WhatsApp providers for sending messages to borrowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable WhatsApp Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send WhatsApp messages to borrowers
                  </p>
                </div>
                <Switch
                  checked={settings.whatsapp_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, whatsapp_enabled: checked })
                  }
                />
              </div>

              {settings.whatsapp_enabled && (
                <>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>WhatsApp Provider</Label>
                    <Select
                      value={settings.whatsapp_provider}
                      onValueChange={(value: any) => 
                        setSettings({ ...settings, whatsapp_provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="africastalking">Africa's Talking</SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="respondio">Respond.io</SelectItem>
                        <SelectItem value="none">None (Disabled)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.whatsapp_provider === "africastalking" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Africa's Talking WhatsApp</h4>
                      <div className="space-y-2">
                        <Label>WhatsApp Number</Label>
                        <Input
                          type="text"
                          placeholder="+260123456789"
                          value={settings.africastalking_whatsapp_number}
                          onChange={(e) => 
                            setSettings({ ...settings, africastalking_whatsapp_number: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Your registered Africa's Talking WhatsApp business number
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uses the Africa's Talking username and API key from the SMS tab.
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.whatsapp_provider === "twilio" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Twilio WhatsApp</h4>
                      <div className="space-y-2">
                        <Label>WhatsApp Number</Label>
                        <Input
                          type="text"
                          placeholder="whatsapp:+14155238886"
                          value={settings.twilio_whatsapp_number}
                          onChange={(e) => 
                            setSettings({ ...settings, twilio_whatsapp_number: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Twilio WhatsApp-enabled number (format: whatsapp:+1234567890)
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.whatsapp_provider === "respondio" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Respond.io WhatsApp Business</h4>
                      <p className="text-sm text-muted-foreground">
                        Send WhatsApp template messages via Respond.io. Your WhatsApp Business number must be connected to Respond.io as a channel.
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>API Key *</Label>
                          <Input
                            type="password"
                            placeholder="your-respondio-api-key"
                            value={settings.respondio_api_key}
                            onChange={(e) => 
                              setSettings({ ...settings, respondio_api_key: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Your Respond.io API key (found in Respond.io Settings → API)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input
                            type="text"
                            placeholder="https://api.respond.io/v3"
                            value={settings.respondio_base_url}
                            onChange={(e) => 
                              setSettings({ ...settings, respondio_base_url: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Respond.io API base URL (default: https://api.respond.io/v3)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>WhatsApp Channel ID *</Label>
                          <Input
                            type="text"
                            placeholder="channel-id-from-respondio"
                            value={settings.respondio_whatsapp_channel_id}
                            onChange={(e) => 
                              setSettings({ ...settings, respondio_whatsapp_channel_id: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            The WhatsApp channel ID from Respond.io (found in Channels → WhatsApp → Channel ID)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.whatsapp_provider !== "none" && (
                    <Button 
                      variant="outline" 
                      onClick={testWhatsAppProvider}
                      disabled={testingProvider === "whatsapp"}
                    >
                      {testingProvider === "whatsapp" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Test WhatsApp Connection
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Configuration */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure email providers for sending emails to borrowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to borrowers
                  </p>
                </div>
                <Switch
                  checked={settings.email_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, email_enabled: checked })
                  }
                />
              </div>

              {settings.email_enabled && (
                <>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select
                      value={settings.email_provider}
                      onValueChange={(value: any) => 
                        setSettings({ ...settings, email_provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="smtp">SMTP</SelectItem>
                        <SelectItem value="none">None (Disabled)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.email_provider === "sendgrid" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">SendGrid Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            placeholder="SG.xxxxxxxxxxxxxxx"
                            value={settings.sendgrid_api_key}
                            onChange={(e) => 
                              setSettings({ ...settings, sendgrid_api_key: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Email</Label>
                          <Input
                            type="email"
                            placeholder="noreply@phindu.com"
                            value={settings.sendgrid_from_email}
                            onChange={(e) => 
                              setSettings({ ...settings, sendgrid_from_email: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Name</Label>
                          <Input
                            type="text"
                            placeholder="Phindu Finance"
                            value={settings.sendgrid_from_name}
                            onChange={(e) => 
                              setSettings({ ...settings, sendgrid_from_name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.email_provider === "smtp" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">SMTP Configuration</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>SMTP Host</Label>
                          <Input
                            type="text"
                            placeholder="smtp.gmail.com"
                            value={settings.smtp_host}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_host: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SMTP Port</Label>
                          <Input
                            type="number"
                            placeholder="587"
                            value={settings.smtp_port}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 587 })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Username</Label>
                          <Input
                            type="text"
                            placeholder="your@email.com"
                            value={settings.smtp_username}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_username: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input
                            type="password"
                            placeholder="Your password or app password"
                            value={settings.smtp_password}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_password: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Email</Label>
                          <Input
                            type="email"
                            placeholder="noreply@phindu.co.zm"
                            value={settings.smtp_from_email}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_from_email: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Name</Label>
                          <Input
                            type="text"
                            placeholder="Phindu Finance"
                            value={settings.smtp_from_name}
                            onChange={(e) => 
                              setSettings({ ...settings, smtp_from_name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.email_provider !== "none" && (
                    <Button 
                      variant="outline" 
                      onClick={testEmailProvider}
                      disabled={testingProvider === "email"}
                    >
                      {testingProvider === "email" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Test Email Connection
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Preferences */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Notification Events
              </CardTitle>
              <CardDescription>
                Choose which events trigger notifications to borrowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: "notify_on_signup", label: "New Account Sign Up", description: "Welcome message when borrower creates account" },
                  { key: "notify_on_loan_approval", label: "Loan Approval", description: "Notify when loan application is approved" },
                  { key: "notify_on_loan_rejection", label: "Loan Rejection", description: "Notify when loan application is rejected" },
                  { key: "notify_on_disbursement", label: "Loan Disbursement", description: "Notify when funds are disbursed" },
                  { key: "notify_on_payment_received", label: "Payment Received", description: "Confirm receipt of loan payments" },
                  { key: "notify_on_payment_reminder", label: "Payment Reminders", description: "Remind borrowers of upcoming payments" },
                  { key: "notify_on_overdue", label: "Overdue Notices", description: "Alert borrowers of overdue payments" },
                  { key: "notify_on_loan_completion", label: "Loan Completion", description: "Congratulate borrowers on full repayment" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">{item.label}</Label>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={settings[item.key as keyof NotificationProviderSettings] as boolean}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, [item.key]: checked })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setSettings(savedSettings || defaultSettings)}>
          Reset Changes
        </Button>
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Notification Settings
        </Button>
      </div>

      {/* Info Alert */}
      <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400">
          <p className="font-medium mb-1">Provider Setup Instructions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Africa's Talking:</strong> Create account at africastalking.com, get API key from dashboard</li>
            <li><strong>Twilio:</strong> Create account at twilio.com, get Account SID and Auth Token from console</li>
            <li><strong>SendGrid:</strong> Create account at sendgrid.com, generate API key with mail send permissions</li>
            <li><strong>SMTP:</strong> Use your email provider's SMTP settings (Gmail, Outlook, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
