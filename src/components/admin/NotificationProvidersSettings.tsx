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
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  MessageSquare, 
  Mail, 
  Phone, 
  CheckCircle, 
  AlertCircle,
  Send,
  Zap,
  DollarSign
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
  whatsapp_provider: "fonnte" | "twilio" | "none";
  fonnte_api_token: string;
  fonnte_device_id: string;
  twilio_whatsapp_number: string;
  
  // Email Settings
  email_enabled: boolean;
  email_provider: "resend" | "sendgrid" | "none";
  resend_api_key: string;
  resend_from_email: string;
  resend_from_name: string;
  sendgrid_api_key: string;
  sendgrid_from_email: string;
  sendgrid_from_name: string;
  
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
  sms_provider: "africastalking",
  africastalking_username: "",
  africastalking_api_key: "",
  africastalking_sender_id: "PHINDU",
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_phone_number: "",
  
  whatsapp_enabled: false,
  whatsapp_provider: "fonnte",
  fonnte_api_token: "",
  fonnte_device_id: "",
  twilio_whatsapp_number: "",
  
  email_enabled: false,
  email_provider: "resend",
  resend_api_key: "",
  resend_from_email: "",
  resend_from_name: "Phindu Finance",
  sendgrid_api_key: "",
  sendgrid_from_email: "",
  sendgrid_from_name: "Phindu Finance",
  
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
    if (!testPhone) {
      toast({ title: "Enter a test phone number", variant: "destructive" });
      return;
    }
    setTestingProvider("sms");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "sms",
          to: testPhone,
          message: "Test SMS from Phindu Finance. If you received this, SMS is working! 🎉",
          title: "Test SMS",
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send");
      
      toast({
        title: "SMS Test Successful ✅",
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
    if (!testPhone) {
      toast({ title: "Enter a test phone number", variant: "destructive" });
      return;
    }
    setTestingProvider("whatsapp");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "whatsapp",
          to: testPhone,
          message: "Test WhatsApp message from Phindu Finance. If you received this, WhatsApp is working! 🎉",
          title: "Test WhatsApp",
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send");
      
      toast({
        title: "WhatsApp Test Successful ✅",
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
    if (!testEmail) {
      toast({ title: "Enter a test email address", variant: "destructive" });
      return;
    }
    setTestingProvider("email");
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "email",
          to: testEmail,
          subject: "Test Email - Phindu Finance",
          message: "This is a test email from Phindu Finance notification system. If you received this, email is working! 🎉",
          title: "Test Email",
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send");
      
      toast({
        title: "Email Test Successful ✅",
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
      {/* Budget-friendly notice */}
      <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">Budget-Friendly Providers Configured</p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            <strong>SMS:</strong> Africa's Talking (~K0.15/SMS) • 
            <strong> WhatsApp:</strong> Fonnte (~$6/month unlimited) • 
            <strong> Email:</strong> Resend (3,000 free/month)
          </p>
        </div>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sms" className="gap-2">
            <Phone className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Send className="h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* SMS Configuration */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                SMS Notifications
                {settings.sms_enabled && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>}
              </CardTitle>
              <CardDescription>
                Send SMS notifications to borrowers for loan updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send SMS to borrowers for important updates
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
                        <SelectItem value="africastalking">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-orange-500" />
                            Africa's Talking
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="none">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.sms_provider === "africastalking" && (
                    <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-600" />
                        <h4 className="font-medium">Africa's Talking Configuration</h4>
                        <Badge className="bg-orange-100 text-orange-700 text-xs">~K0.15/SMS</Badge>
                      </div>
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
                          <p className="text-xs text-muted-foreground">Use "sandbox" for testing</p>
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
                          <p className="text-xs text-muted-foreground">Shows as the sender name</p>
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
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Enter test phone (e.g., 0971234567)"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={testSMSProvider}
                        disabled={testingProvider === "sms"}
                      >
                        {testingProvider === "sms" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Send Test SMS
                      </Button>
                    </div>
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
                <MessageSquare className="h-5 w-5 text-green-600" />
                WhatsApp Notifications
                {settings.whatsapp_enabled && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>}
              </CardTitle>
              <CardDescription>
                Send WhatsApp messages to borrowers - most popular messaging app in Zambia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable WhatsApp Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send WhatsApp messages for loan updates
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
                        <SelectItem value="fonnte">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-green-500" />
                            Fonnte
                            <Badge variant="secondary" className="text-xs">Cheapest</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="twilio">Twilio (WhatsApp Business)</SelectItem>
                        <SelectItem value="none">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.whatsapp_provider === "fonnte" && (
                    <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium">Fonnte Configuration</h4>
                        <Badge className="bg-green-100 text-green-700 text-xs">~$6/month unlimited</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Fonnte is the most affordable WhatsApp API. Sign up at <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">fonnte.com</a>
                      </p>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>API Token</Label>
                          <Input
                            type="password"
                            placeholder="Your Fonnte API token"
                            value={settings.fonnte_api_token}
                            onChange={(e) => 
                              setSettings({ ...settings, fonnte_api_token: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">Found in your Fonnte dashboard under API settings</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Device ID (Optional)</Label>
                          <Input
                            type="text"
                            placeholder="Your device ID (if using multiple devices)"
                            value={settings.fonnte_device_id}
                            onChange={(e) => 
                              setSettings({ ...settings, fonnte_device_id: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.whatsapp_provider === "twilio" && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium">Twilio WhatsApp Business</h4>
                      <p className="text-sm text-muted-foreground">
                        Uses the same Twilio credentials as SMS. Make sure WhatsApp is enabled on your Twilio account.
                      </p>
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
                          <Label>WhatsApp Number</Label>
                          <Input
                            type="text"
                            placeholder="whatsapp:+14155238886"
                            value={settings.twilio_whatsapp_number}
                            onChange={(e) => 
                              setSettings({ ...settings, twilio_whatsapp_number: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">Format: whatsapp:+1234567890</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.whatsapp_provider !== "none" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Enter test phone (e.g., 0971234567)"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={testWhatsAppProvider}
                        disabled={testingProvider === "whatsapp"}
                      >
                        {testingProvider === "whatsapp" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Send Test WhatsApp
                      </Button>
                    </div>
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
                <Mail className="h-5 w-5 text-blue-600" />
                Email Notifications
                {settings.email_enabled && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>}
              </CardTitle>
              <CardDescription>
                Send email notifications to borrowers for detailed loan information
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
                        <SelectItem value="resend">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            Resend
                            <Badge variant="secondary" className="text-xs">3,000 free/mo</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="none">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.email_provider === "resend" && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium">Resend Configuration</h4>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">3,000 free emails/month</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Resend is the easiest email API. Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a>
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            placeholder="re_xxxxxxxxxxxxxxx"
                            value={settings.resend_api_key}
                            onChange={(e) => 
                              setSettings({ ...settings, resend_api_key: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Email</Label>
                          <Input
                            type="email"
                            placeholder="noreply@yourdomain.com"
                            value={settings.resend_from_email}
                            onChange={(e) => 
                              setSettings({ ...settings, resend_from_email: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">Must be from a verified domain</p>
                        </div>
                        <div className="space-y-2">
                          <Label>From Name</Label>
                          <Input
                            type="text"
                            placeholder="Phindu Finance"
                            value={settings.resend_from_name}
                            onChange={(e) => 
                              setSettings({ ...settings, resend_from_name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

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
                            placeholder="noreply@phindu.co.zm"
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

                  {settings.email_provider !== "none" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        placeholder="Enter test email address"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={testEmailProvider}
                        disabled={testingProvider === "email"}
                      >
                        {testingProvider === "email" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Send Test Email
                      </Button>
                    </div>
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
                  { key: "notify_on_signup", label: "New Account Sign Up", description: "Welcome message when borrower creates account", icon: "👋" },
                  { key: "notify_on_loan_approval", label: "Loan Approval", description: "Notify when loan application is approved", icon: "✅" },
                  { key: "notify_on_loan_rejection", label: "Loan Rejection", description: "Notify when loan application is rejected", icon: "❌" },
                  { key: "notify_on_disbursement", label: "Loan Disbursement", description: "Notify when funds are disbursed", icon: "💰" },
                  { key: "notify_on_payment_received", label: "Payment Received", description: "Confirm receipt of loan payments", icon: "🧾" },
                  { key: "notify_on_payment_reminder", label: "Payment Reminders", description: "Remind borrowers of upcoming payments", icon: "⏰" },
                  { key: "notify_on_overdue", label: "Overdue Notices", description: "Alert borrowers of overdue payments", icon: "⚠️" },
                  { key: "notify_on_loan_completion", label: "Loan Completion", description: "Congratulate borrowers on full repayment", icon: "🎉" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <Label className="font-medium">{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
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

      {/* Setup Instructions */}
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
        <h4 className="font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Quick Setup Guide
        </h4>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="font-medium text-orange-800 dark:text-orange-200 mb-1">📱 Africa's Talking (SMS)</p>
            <ol className="list-decimal list-inside text-orange-700 dark:text-orange-300 space-y-1">
              <li>Sign up at <a href="https://africastalking.com" target="_blank" className="underline">africastalking.com</a></li>
              <li>Create an app and get API key</li>
              <li>Use "sandbox" username for testing</li>
            </ol>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="font-medium text-green-800 dark:text-green-200 mb-1">💬 Fonnte (WhatsApp)</p>
            <ol className="list-decimal list-inside text-green-700 dark:text-green-300 space-y-1">
              <li>Sign up at <a href="https://fonnte.com" target="_blank" className="underline">fonnte.com</a></li>
              <li>Connect your WhatsApp number</li>
              <li>Copy API token from dashboard</li>
            </ol>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">📧 Resend (Email)</p>
            <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-1">
              <li>Sign up at <a href="https://resend.com" target="_blank" className="underline">resend.com</a></li>
              <li>Add and verify your domain</li>
              <li>Create API key</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
