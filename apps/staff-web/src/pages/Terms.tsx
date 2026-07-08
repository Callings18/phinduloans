import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useSystemSettings } from "@phinduloans/shared/hooks/useSystemSettings";
import { Link } from "react-router-dom";

const Terms = () => {
  const { data: settings } = useSystemSettings();
  const companyName = settings?.companyInfo?.name || "Phindu Credit Solutions";
  const email = settings?.companyInfo?.support_email || "info@phindu.com";
  const effectiveDate = "1 January 2026";

  const sections = [
    {
      title: "1. Agreement to Terms",
      content: `By accessing the ${companyName} website, borrower application, or applying for credit, you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use our services.`,
    },
    {
      title: "2. Eligibility",
      content:
        "You must be at least 18 years old, a resident of Zambia, and legally capable of entering into binding contracts. You must provide accurate, complete information during application and promptly update us if your circumstances change.",
    },
    {
      title: "3. Loan Products & Applications",
      content:
        "Loan products, amounts, interest rates, fees, and terms are subject to product rules published at the time of application. Submitting an application does not guarantee approval. We reserve the right to decline applications based on credit assessment, affordability, verification outcomes, or regulatory requirements.",
    },
    {
      title: "4. Interest, Fees & Charges",
      content:
        "Applicable interest rates, processing fees, insurance, penalties, and other charges are disclosed in your loan offer and formal loan agreement. Rates may be flat or reducing balance depending on the product. Late payment penalties apply as specified in your agreement.",
    },
    {
      title: "5. Disbursement & Repayment",
      content:
        "Approved loans are disbursed to the payout method verified during onboarding. You agree to repay according to the schedule in your loan agreement via approved channels (mobile money, bank transfer, salary deduction, or other methods we support).",
    },
    {
      title: "6. Default & Recovery",
      content:
        "Failure to repay on time may result in penalties, reporting to credit reference bureaus, collection activity, and legal recovery action where permitted by law. We will follow fair debt collection practices and applicable consumer protection regulations.",
    },
    {
      title: "7. Collateral & Guarantees",
      content:
        "Where collateral or guarantees are required, you agree to provide valid security and maintain it for the loan duration. We may exercise rights over collateral in accordance with your loan agreement and applicable law.",
    },
    {
      title: "8. Account Security",
      content:
        "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us immediately of any unauthorised access or suspected fraud.",
    },
    {
      title: "9. Intellectual Property",
      content:
        "All content, branding, software, and materials on our platforms are owned by or licensed to us. You may not copy, modify, or distribute them without our written consent.",
    },
    {
      title: "10. Limitation of Liability",
      content:
        "To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential losses arising from use of our services, except where liability cannot be excluded under Zambian law. Nothing in these terms limits your statutory rights as a consumer.",
    },
    {
      title: "11. Regulatory Compliance",
      content:
        `${companyName} operates under the regulatory framework of the Bank of Zambia and other applicable authorities. These terms are governed by the laws of the Republic of Zambia.`,
    },
    {
      title: "12. Amendments",
      content:
        "We may update these Terms & Conditions. Continued use after publication of changes constitutes acceptance. Material changes to active loan agreements will be communicated in accordance with your contract.",
    },
    {
      title: "13. Contact",
      content: `For questions about these terms, email ${email} or visit our contact page.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <section className="gradient-hero py-16 relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Terms &amp; <span className="text-gradient">Conditions</span>
              </h1>
              <p className="text-muted-foreground">
                Effective date: {effectiveDate}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto glass rounded-3xl p-8 md:p-12 space-y-8">
              <p className="text-muted-foreground leading-relaxed">
                Please read these Terms & Conditions carefully before using services provided by {companyName}.
              </p>

              {sections.map((section) => (
                <div key={section.title}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{section.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              ))}

              <p className="text-sm text-muted-foreground pt-4 border-t border-border">
                See also our{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link to="/contact" className="text-primary hover:underline">
                  Contact
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
