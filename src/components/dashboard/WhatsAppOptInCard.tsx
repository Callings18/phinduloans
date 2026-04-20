/**
 * WhatsAppOptInCard — borrower-facing helper to opt into Twilio's WhatsApp
 * sandbox. Tapping the button opens a prefilled wa.me link with the `join`
 * keyword so the borrower can complete opt-in in one tap. Hidden once a
 * production WhatsApp sender is approved (just remove from profile tab).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ExternalLink } from "lucide-react";

const TWILIO_SANDBOX_NUMBER = "+15558992764";
const TWILIO_SANDBOX_KEYWORD = "join phindu-credit";

const WhatsAppOptInCard = () => {
  const waNumber = TWILIO_SANDBOX_NUMBER.replace(/[^0-9]/g, "");
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(TWILIO_SANDBOX_KEYWORD)}`;

  return (
    <Card className="border-border/60 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-success/15 p-2 text-success shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Enable WhatsApp updates</p>
            <p className="text-sm text-muted-foreground mt-1">
              Get loan approval, disbursement, and payment reminders on WhatsApp. Tap below and
              send the prefilled message — that's it.
            </p>
            <Button asChild variant="hero" size="sm" className="mt-3">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Opt in on WhatsApp
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppOptInCard;
