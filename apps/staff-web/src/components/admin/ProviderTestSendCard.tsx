/**
 * ProviderTestSendCard — one-click "Test send" for SMS / Email / WhatsApp.
 * Sits in Settings → Notifications so the client can verify provider
 * credentials at a glance without writing test code or finding hidden buttons.
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Loader2, MessageSquare, Mail, Phone, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

type Channel = "sms" | "email" | "whatsapp";

const CHANNELS: { id: Channel; label: string; icon: typeof MessageSquare; placeholder: string }[] = [
  { id: "sms", label: "SMS", icon: MessageSquare, placeholder: "+260971234567" },
  { id: "email", label: "Email", icon: Mail, placeholder: "you@example.com" },
  { id: "whatsapp", label: "WhatsApp", icon: Phone, placeholder: "+260971234567" },
];

interface ResultMap {
  [k: string]: { ok: boolean; message: string } | undefined;
}

const ProviderTestSendCard = () => {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Record<Channel, string>>({
    sms: "",
    email: "",
    whatsapp: "",
  });
  const [pending, setPending] = useState<Record<Channel, boolean>>({
    sms: false,
    email: false,
    whatsapp: false,
  });
  const [results, setResults] = useState<ResultMap>({});

  const handleTest = async (channel: Channel) => {
    const recipient = recipients[channel].trim();
    if (!recipient) {
      toast({
        title: "Recipient required",
        description: `Enter a ${channel === "email" ? "valid email" : "phone number"} to test.`,
        variant: "destructive",
      });
      return;
    }
    setPending((p) => ({ ...p, [channel]: true }));
    setResults((r) => ({ ...r, [channel]: undefined }));
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: channel,
          recipient,
          title: "Phindu test send",
          message: `This is a Phindu test ${channel.toUpperCase()} sent at ${new Date().toLocaleString()}. If you received this, the provider is configured correctly.`,
          subject: channel === "email" ? "Phindu test send" : undefined,
        },
      });
      if (error) throw error;
      setResults((r) => ({ ...r, [channel]: { ok: true, message: "Sent. Check the recipient." } }));
      toast({ title: "Test sent", description: `Check the ${channel} recipient.` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setResults((r) => ({ ...r, [channel]: { ok: false, message } }));
      toast({ title: "Test failed", description: message, variant: "destructive" });
    } finally {
      setPending((p) => ({ ...p, [channel]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test send</CardTitle>
        <CardDescription>
          Verify each provider works. Sends a single real message via the notification queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {CHANNELS.map(({ id, label, icon: Icon, placeholder }) => {
          const result = results[id];
          return (
            <div key={id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" /> {label}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder={placeholder}
                  value={recipients[id]}
                  onChange={(e) => setRecipients((r) => ({ ...r, [id]: e.target.value }))}
                  className="flex-1"
                />
                <Button onClick={() => handleTest(id)} disabled={pending[id]} variant="outline">
                  {pending[id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send test
                </Button>
              </div>
              {result && (
                <div
                  className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`}
                >
                  {result.ok ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{result.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ProviderTestSendCard;
