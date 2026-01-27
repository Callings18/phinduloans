import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Mail, MessageSquare, Phone, Send, RefreshCw, AlertCircle, 
  CheckCircle, Clock, Loader2, Play, Settings
} from "lucide-react";

interface NotificationSettings {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  notify_on_signup: boolean;
  notify_on_application_submitted: boolean;
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_payment_received: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_loan_completion: boolean;
  notify_on_court_case: boolean;
  notify_on_contract_sent: boolean;
}

interface QueuedNotification {
  id: string;
  type: string;
  recipient: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
}

const defaultSettings: NotificationSettings = {
  sms_enabled: true,
  whatsapp_enabled: true,
  email_enabled: true,
  notify_on_signup: true,
  notify_on_application_submitted: true,
  notify_on_loan_approval: true,
  notify_on_loan_rejection: true,
  notify_on_disbursement: true,
  notify_on_payment_received: true,
  notify_on_payment_reminder: true,
  notify_on_overdue: true,
  notify_on_loan_completion: true,
  notify_on_court_case: true,
  notify_on_contract_sent: true,
};

export default function NotificationSettingsPanel() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = React.useState<NotificationSettings>(defaultSettings);
  const [saving, setSaving] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [testRecipient, setTestRecipient] = React.useState("");
  const [testType, setTestType] = React.useState<"sms" | "email" | "whatsapp">("email");
  const [sendingTest, setSendingTest] = React.useState(false);

  // Fetch current settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "notification_providers")
        .maybeSingle();
      
      if (error) throw error;
      if (!data?.value) return null;
      return data.value as unknown as NotificationSettings;
    },
  });

  // Fetch pending notifications
  const { data: pendingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ["notification-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as QueuedNotification[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch notification stats
  const { data: stats } = useQuery({
    queryKey: ["notification-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("status, type")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const pending = data?.filter(n => n.status === "pending").length || 0;
      const sent = data?.filter(n => n.status === "sent").length || 0;
      const failed = data?.filter(n => n.status === "failed").length || 0;
      
      return { pending, sent, failed, total: data?.length || 0 };
    },
  });

  React.useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
  }, [savedSettings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // First check if setting exists
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "notification_providers")
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("system_settings")
          .update({
            value: settings as any,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "notification_providers");
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("system_settings")
          .insert([{
            key: "notification_providers",
            value: settings as any,
          }]);
        if (error) throw error;
      }
      
      toast.success("Notification settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    } catch (error: any) {
      toast.error("Failed to save settings: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProcessQueue = async () => {
    if (!pendingQueue?.length) {
      toast.info("No pending notifications to process");
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const notification of pendingQueue) {
        try {
          const { data, error } = await supabase.functions.invoke("send-notification", {
            body: {
              type: notification.type,
              to: notification.recipient,
              message: notification.message,
              subject: notification.title,
              title: notification.title,
            },
          });

          if (error) throw error;

          // Update status to sent
          await supabase
            .from("notification_logs")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(),
              provider_response: data 
            })
            .eq("id", notification.id);

          successCount++;
        } catch (sendError: any) {
          console.error(`Failed to send notification ${notification.id}:`, sendError);
          
          // Update status to failed
          await supabase
            .from("notification_logs")
            .update({ 
              status: "failed", 
              provider_response: { error: sendError.message } 
            })
            .eq("id", notification.id);

          failCount++;
        }
      }

      toast.success(`Processed ${successCount} notifications${failCount > 0 ? `, ${failCount} failed` : ""}`);
      refetchQueue();
      queryClient.invalidateQueries({ queryKey: ["notification-stats"] });
    } catch (error: any) {
      toast.error("Queue processing error: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient) {
      toast.error("Please enter a recipient");
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: testType,
          to: testRecipient,
          message: "This is a test notification from Phindu Finance. If you received this, your notification settings are working correctly!",
          subject: "Test Notification - Phindu Finance",
          title: "Test Notification",
        },
      });

      if (error) throw error;
      
      toast.success(`Test ${testType.toUpperCase()} sent successfully!`);
    } catch (error: any) {
      toast.error(`Failed to send test: ${error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Sent (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Queue Alert */}
      {pendingQueue && pendingQueue.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <Clock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{pendingQueue.length}</strong> notifications waiting to be sent
            </span>
            <Button 
              size="sm" 
              onClick={handleProcessQueue}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Send All Now
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="queue">Queue ({pendingQueue?.length || 0})</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Enable or disable notification channels. Credentials are stored securely in Cloud Secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SMS Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Phone className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">SMS (Twilio)</h4>
                    <p className="text-sm text-muted-foreground">
                      Send SMS via Twilio. Configure in Cloud → Secrets.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.sms_enabled}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, sms_enabled: checked }))}
                />
              </div>

              {/* WhatsApp Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">WhatsApp (Twilio)</h4>
                    <p className="text-sm text-muted-foreground">
                      Send WhatsApp messages via Twilio. Configure in Cloud → Secrets.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Required: TWILIO_WHATSAPP_NUMBER (e.g., whatsapp:+14155238886)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.whatsapp_enabled}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, whatsapp_enabled: checked }))}
                />
              </div>

              {/* Email Channel */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <Mail className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Email (SendGrid)</h4>
                    <p className="text-sm text-muted-foreground">
                      Send emails via SendGrid. Configure in Cloud → Secrets.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Required: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.email_enabled}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, email_enabled: checked }))}
                />
              </div>

              <Separator />

              <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Channel Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Events</CardTitle>
              <CardDescription>
                Choose which events trigger notifications to borrowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "notify_on_signup", label: "New Signup", desc: "When a new user registers" },
                  { key: "notify_on_application_submitted", label: "Application Submitted", desc: "When loan application is submitted" },
                  { key: "notify_on_loan_approval", label: "Loan Approval", desc: "When loan is approved" },
                  { key: "notify_on_loan_rejection", label: "Loan Rejection", desc: "When loan is rejected" },
                  { key: "notify_on_disbursement", label: "Disbursement", desc: "When funds are disbursed" },
                  { key: "notify_on_payment_received", label: "Payment Received", desc: "When payment is received" },
                  { key: "notify_on_payment_reminder", label: "Payment Reminder", desc: "Before payment is due" },
                  { key: "notify_on_overdue", label: "Overdue Notice", desc: "When payment is overdue" },
                  { key: "notify_on_loan_completion", label: "Loan Completion", desc: "When loan is fully repaid" },
                  { key: "notify_on_court_case", label: "Court Case", desc: "Legal action notifications" },
                  { key: "notify_on_contract_sent", label: "Contract Sent", desc: "When contract is sent for signing" },
                ].map((event) => (
                  <div key={event.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.desc}</p>
                    </div>
                    <Switch
                      checked={settings[event.key as keyof NotificationSettings] as boolean}
                      onCheckedChange={(checked) => 
                        setSettings(s => ({ ...s, [event.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Event Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notification Queue</CardTitle>
                <CardDescription>
                  Pending notifications waiting to be sent
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchQueue()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleProcessQueue}
                  disabled={processing || !pendingQueue?.length}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Send All
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingQueue?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending notifications</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pendingQueue?.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {notification.type === "email" && <Mail className="h-4 w-4 text-purple-500" />}
                        {notification.type === "sms" && <Phone className="h-4 w-4 text-blue-500" />}
                        {notification.type === "whatsapp" && <MessageSquare className="h-4 w-4 text-green-500" />}
                        <div>
                          <p className="text-sm font-medium truncate max-w-xs">{notification.title || "Notification"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{notification.recipient}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Notification</CardTitle>
              <CardDescription>
                Test your notification configuration by sending a test message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {["email", "sms", "whatsapp"].map((type) => (
                  <Button
                    key={type}
                    variant={testType === type ? "default" : "outline"}
                    onClick={() => setTestType(type as any)}
                    className="w-full"
                  >
                    {type === "email" && <Mail className="h-4 w-4 mr-2" />}
                    {type === "sms" && <Phone className="h-4 w-4 mr-2" />}
                    {type === "whatsapp" && <MessageSquare className="h-4 w-4 mr-2" />}
                    {type.toUpperCase()}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="testRecipient">
                  {testType === "email" ? "Email Address" : "Phone Number"}
                </Label>
                <Input
                  id="testRecipient"
                  placeholder={testType === "email" ? "test@example.com" : "+260971234567"}
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSendTest} 
                disabled={sendingTest || !testRecipient}
                className="w-full"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test {testType.toUpperCase()}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
