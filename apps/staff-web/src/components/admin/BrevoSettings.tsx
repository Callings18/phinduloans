import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { 
  Loader2, 
  MessageSquare, 
  Phone, 
  CheckCircle, 
  AlertCircle,
  Send,
  Settings,
  Eye,
  EyeOff,
  TestTube,
  History
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@phinduloans/shared/components/ui/dialog";
import { ScrollArea } from "@phinduloans/shared/components/ui/scroll-area";
import { format } from "date-fns";

interface BrevoSettings {
  brevo_api_key: string;
  brevo_sender_name: string;
  brevo_sender_phone: string;
  brevo_sms_enabled: boolean;
  brevo_whatsapp_enabled: boolean;
  // Notification event toggles
  notify_on_signup: boolean;
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_payment_received: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_loan_completion: boolean;
}

interface WhatsAppTemplate {
  id: string;
  event_type: string;
  template_id: string;
  template_name: string;
  description: string;
  is_active: boolean;
}

interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  title: string;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  provider_response: any;
}

const defaultSettings: BrevoSettings = {
  brevo_api_key: "",
  brevo_sender_name: "Phindu Finance",
  brevo_sender_phone: "",
  brevo_sms_enabled: false,
  brevo_whatsapp_enabled: false,
  notify_on_signup: true,
  notify_on_loan_approval: true,
  notify_on_loan_rejection: true,
  notify_on_disbursement: true,
  notify_on_payment_received: true,
  notify_on_payment_reminder: true,
  notify_on_overdue: true,
  notify_on_loan_completion: true,
};

export const BrevoSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<BrevoSettings>(defaultSettings);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testType, setTestType] = useState<'sms' | 'whatsapp'>('sms');
  const [testRecipient, setTestRecipient] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);

  // Fetch Brevo settings
  const { data: savedSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["brevo-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "brevo_settings")
        .maybeSingle();

      if (error) throw error;
      if (!data?.value) return null;
      return data.value as unknown as BrevoSettings;
    },
  });

  // Fetch WhatsApp templates
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["brevo-whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brevo_whatsapp_templates")
        .select("*")
        .order("event_type");

      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  // Fetch notification logs
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["notification-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as NotificationLog[];
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
  }, [savedSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: BrevoSettings) => {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "brevo_settings")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ 
            value: JSON.parse(JSON.stringify(newSettings)), 
            updated_at: new Date().toISOString() 
          })
          .eq("key", "brevo_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert([{ 
            key: "brevo_settings", 
            value: JSON.parse(JSON.stringify(newSettings)),
            description: "Brevo notification provider settings"
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-settings"] });
      toast({
        title: "Settings Saved",
        description: "Brevo settings have been updated successfully.",
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

  // Update WhatsApp template
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: Partial<WhatsAppTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("brevo_whatsapp_templates")
        .update({
          template_id: template.template_id,
          template_name: template.template_name,
          is_active: template.is_active,
        })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-whatsapp-templates"] });
      setEditingTemplate(null);
      toast({
        title: "Template Updated",
        description: "WhatsApp template mapping has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(settings);
  };

  const handleTestNotification = async () => {
    if (!testRecipient) {
      toast({
        title: "Recipient Required",
        description: "Please enter a recipient phone number.",
        variant: "destructive",
      });
      return;
    }

    setTestingChannel(testType);
    try {
      const payload: any = {
        type: testType,
        to: testRecipient,
        message: `Test ${testType} notification from Phindu Finance via Brevo. Sent at ${new Date().toLocaleString()}`,
      };




      const { data, error } = await supabase.functions.invoke("brevo-notification", {
        body: payload,
      });

      if (error) throw error;

      toast({
        title: "Test Successful",
        description: `Test ${testType} sent successfully!`,
      });
      setTestDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingChannel(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'disabled':
        return <Badge variant="secondary">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'sms':
        return <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" /> SMS</Badge>;
      case 'whatsapp':
        return <Badge variant="outline" className="gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brevo Notifications</h2>
          <p className="text-muted-foreground">
            Configure Brevo for SMS and WhatsApp notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
            <TestTube className="h-4 w-4 mr-2" />
            Test Notification
          </Button>
          <Button onClick={handleSave} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="api">
            <Settings className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="channels">
            <Send className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="events">
            <CheckCircle className="h-4 w-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* API Configuration */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>Brevo API Configuration</CardTitle>
              <CardDescription>
                Enter your Brevo API key. Get it from{" "}
                <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Brevo Dashboard → SMTP & API
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="xkeysib-xxxxxxxxxxxxx"
                    value={settings.brevo_api_key}
                    onChange={(e) => setSettings({ ...settings, brevo_api_key: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your Brevo API key is used for SMS and WhatsApp. Never share this key.
                </p>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sender Name</Label>
                  <Input
                    placeholder="Phindu Finance"
                    value={settings.brevo_sender_name}
                    onChange={(e) => setSettings({ ...settings, brevo_sender_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Sender Phone (for SMS/WhatsApp)</Label>
                  <Input
                    placeholder="PHINDU or +260123456789"
                    value={settings.brevo_sender_phone}
                    onChange={(e) => setSettings({ ...settings, brevo_sender_phone: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use an alphanumeric sender ID or your registered phone number
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Toggles */}
        <TabsContent value="channels">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Enable or disable notification channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">


              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Phone className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">SMS Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Send transactional SMS via Brevo
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.brevo_sms_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, brevo_sms_enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">WhatsApp Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Send WhatsApp messages using approved templates
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.brevo_whatsapp_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, brevo_whatsapp_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Templates */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Template Mappings</CardTitle>
              <CardDescription>
                Map system events to your approved Brevo WhatsApp templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Template ID</TableHead>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium capitalize">{template.event_type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{template.template_id || 'Not Set'}</code>
                        </TableCell>
                        <TableCell>{template.template_name}</TableCell>
                        <TableCell>
                          {template.is_active ? (
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Preferences */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Notification Events</CardTitle>
              <CardDescription>
                Choose which system events trigger notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: 'notify_on_signup', label: 'New User Signup', desc: 'Welcome message to new users' },
                  { key: 'notify_on_loan_approval', label: 'Loan Approval', desc: 'When a loan is approved' },
                  { key: 'notify_on_loan_rejection', label: 'Loan Rejection', desc: 'When a loan is rejected' },
                  { key: 'notify_on_disbursement', label: 'Disbursement', desc: 'When funds are disbursed' },
                  { key: 'notify_on_payment_received', label: 'Payment Received', desc: 'When payment is recorded' },
                  { key: 'notify_on_payment_reminder', label: 'Payment Reminder', desc: 'Before payment due date' },
                  { key: 'notify_on_overdue', label: 'Overdue Notice', desc: 'When payment is overdue' },
                  { key: 'notify_on_loan_completion', label: 'Loan Completion', desc: 'When loan is fully paid' },
                ].map((event) => (
                  <div key={event.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{event.label}</p>
                      <p className="text-sm text-muted-foreground">{event.desc}</p>
                    </div>
                    <Switch
                      checked={settings[event.key as keyof BrevoSettings] as boolean}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, [event.key]: checked })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>
                View recent notification delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>{getTypeBadge(log.type)}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {log.recipient}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.title}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status || 'unknown')}</TableCell>
                        </TableRow>
                      ))}
                      {(!logs || logs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No notification logs yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Notification Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Notification</DialogTitle>
            <DialogDescription>
              Send a test notification to verify your Brevo configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <div className="flex gap-2">

                <Button
                  variant={testType === 'sms' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setTestType('sms'); setTestRecipient(''); }}
                >
                  <Phone className="h-4 w-4 mr-1" /> SMS
                </Button>
                <Button
                  variant={testType === 'whatsapp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setTestType('whatsapp'); setTestRecipient(''); }}
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+260977123456"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestNotification} disabled={testingChannel !== null}>
              {testingChannel && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit WhatsApp Template</DialogTitle>
            <DialogDescription>
              Map this event to your approved Brevo WhatsApp template
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Input value={editingTemplate.event_type} disabled />
              </div>
              <div className="space-y-2">
                <Label>Template ID</Label>
                <Input
                  placeholder="Enter Brevo template ID"
                  value={editingTemplate.template_id}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, template_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="Descriptive name"
                  value={editingTemplate.template_name || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, template_name: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editingTemplate.is_active}
                  onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingTemplate && updateTemplateMutation.mutate(editingTemplate)}
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};