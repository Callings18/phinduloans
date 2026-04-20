import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MessageCircle, Mail, Phone, HelpCircle } from "lucide-react";

const SUPPORT_PHONE = "+260967713001";
const SUPPORT_WHATSAPP = "260967713001";
const SUPPORT_EMAIL = "support@phindu.com";

interface Props {
  borrowerName?: string;
  loanReference?: string;
}

const FAQS = [
  {
    q: "How long does loan approval take?",
    a: "Most applications are reviewed within 24–48 hours. You will get an SMS, email, and dashboard notification the moment a decision is made.",
  },
  {
    q: "How do I make a repayment?",
    a: "Pay via mobile money or bank deposit using the details we shared on approval, then go to Payments → 'I've paid' to submit your reference for verification.",
  },
  {
    q: "When does my KYC need to be re-uploaded?",
    a: "Once your KYC is verified, your documents are stored permanently. You don't need to upload again for future loans unless something changes (e.g. NRC renewed).",
  },
  {
    q: "Where will my approved loan be deposited?",
    a: "Funds are sent to the payout destination (mobile money or bank account) you declared in your Profile. Update it before applying if needed.",
  },
  {
    q: "What happens if I miss a repayment?",
    a: "A late penalty may apply per your product terms. Contact us immediately via WhatsApp so we can arrange a workable plan and protect your credit standing.",
  },
  {
    q: "How do I download my receipts and statements?",
    a: "Go to Payments → tap 'Receipt' next to any paid installment, or open My Loans → Statement (PDF) / Statement CSV.",
  },
];

export default function BorrowerSupportCard({ borrowerName, loanReference }: Props) {
  const prefilled = `Hello Phindu Credit, I'm ${borrowerName || "a borrower"}${loanReference ? ` (Ref: ${loanReference})` : ""}. I need help with: `;
  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(prefilled)}`;
  const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Support request${loanReference ? ` – ${loanReference}` : ""}`)}&body=${encodeURIComponent(prefilled)}`;
  const telUrl = `tel:${SUPPORT_PHONE}`;

  return (
    <Card className="border-border/60 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle size={16} className="text-primary" /> Help & Support
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button asChild variant="outline" className="justify-start gap-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} className="text-success" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start gap-2">
            <a href={telUrl}>
              <Phone size={16} className="text-primary" /> Call us
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start gap-2">
            <a href={emailUrl}>
              <Mail size={16} className="text-info" /> Email
            </a>
          </Button>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Frequently asked questions
          </p>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
