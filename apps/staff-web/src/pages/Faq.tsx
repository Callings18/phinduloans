import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@phinduloans/shared/components/ui/accordion";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSystemSettings } from "@phinduloans/shared/hooks/useSystemSettings";
import { borrowerAppPath } from "@/config/publicUrls";

const faqs = [
  {
    question: "Who can apply for a loan with Phindu Credit Solutions?",
    answer:
      "Zambian residents aged 18 and above with a valid NRC, active mobile money or bank account, and verifiable income or collateral (depending on the product) may apply. Employment type, location, and product-specific rules may apply.",
  },
  {
    question: "How long does loan approval take?",
    answer:
      "Most applications are reviewed within 24–48 business hours once all required documents are submitted. Complex cases or collateral-backed loans may take slightly longer while we complete verification.",
  },
  {
    question: "What documents do I need to apply?",
    answer:
      "Typically you will need your NRC, proof of income (payslip or bank statement), proof of residence, and any product-specific documents such as collateral details or employer confirmation. Exact requirements are shown for each loan product.",
  },
  {
    question: "How are repayments made?",
    answer:
      "Repayments can be made via mobile money, bank transfer, or salary deduction where your employer has an arrangement with us. Your repayment schedule and due dates are available in the borrower app after disbursement.",
  },
  {
    question: "What happens if I miss a repayment?",
    answer:
      "Late payments may attract penalties as set out in your loan agreement. We encourage you to contact us before your due date if you anticipate difficulty — we may be able to discuss a workable arrangement.",
  },
  {
    question: "Can I repay my loan early?",
    answer:
      "Early repayment may be permitted depending on your loan product. Some products include an early settlement fee. Check your product terms or contact our support team for details specific to your loan.",
  },
  {
    question: "Is my personal information safe?",
    answer:
      "Yes. We process personal data in line with the Zambia Data Protection Act, 2021. Information is used only for credit assessment, loan servicing, and regulatory compliance. See our Privacy Policy for full details.",
  },
  {
    question: "How do I check my loan balance or application status?",
    answer:
      "Create an account or sign in to the Phindu borrower app to track applications, view balances, download statements, and receive payment reminders in real time.",
  },
];

const Faq = () => {
  const { data: settings } = useSystemSettings();
  const companyName = settings?.companyInfo?.name || "Phindu Credit Solutions";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <section className="gradient-hero py-20 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl gradient-primary mb-6">
                <HelpCircle className="text-primary-foreground" size={28} />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Frequently Asked <span className="text-gradient">Questions</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Answers to common questions about borrowing with {companyName}.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto glass rounded-3xl p-6 md:p-10">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-foreground font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center glass rounded-3xl p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Still have questions?
              </h2>
              <p className="text-muted-foreground mb-8">
                Our team is ready to help. Reach out via the contact page or start your application online.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="outline" size="lg" asChild>
                  <Link to="/contact">Contact Us</Link>
                </Button>
                <Button variant="hero" size="lg" asChild>
                  <a href={borrowerAppPath("/auth?mode=signup")}>
                    Get Started
                    <ArrowRight size={20} />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Faq;
