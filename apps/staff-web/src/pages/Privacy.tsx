import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useSystemSettings } from "@phinduloans/shared/hooks/useSystemSettings";
import { Link } from "react-router-dom";

const Privacy = () => {
  const { data: settings } = useSystemSettings();
  const companyName = settings?.companyInfo?.name || "Phindu Credit Solutions";
  const email = settings?.companyInfo?.support_email || "info@phindu.com";
  const address = settings?.companyInfo?.address || "Lusaka, Zambia";
  const effectiveDate = "1 January 2026";

  const sections = [
    {
      title: "1. Introduction",
      content: `${companyName} ("we", "us", or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and share information when you visit our website, use our borrower application, or interact with our lending services in Zambia.`,
    },
    {
      title: "2. Data We Collect",
      content:
        "We may collect identity information (name, NRC, date of birth), contact details (phone, email, address), financial information (income, employment, bank or mobile money details), loan application data, repayment history, device and usage data, and documents you upload for verification (payslips, proof of residence, collateral records).",
    },
    {
      title: "3. How We Use Your Data",
      content:
        "We use your data to assess creditworthiness, process loan applications, disburse funds, manage repayments, communicate with you about your account, comply with Bank of Zambia and other regulatory requirements, prevent fraud, and improve our services. We do not sell your personal data to third parties.",
    },
    {
      title: "4. Legal Basis",
      content:
        "We process personal data based on your consent, performance of a contract (your loan agreement), compliance with legal obligations, and our legitimate interests in operating a responsible lending business, subject to the Zambia Data Protection Act, 2021 and applicable financial services regulations.",
    },
    {
      title: "5. Credit Reference Checks",
      content:
        "Where permitted and required for your chosen product, we may obtain credit reports from licensed credit reference bureaus in Zambia. This helps us make fair lending decisions. Enquiries may appear on your credit record in line with bureau policies.",
    },
    {
      title: "6. Data Sharing",
      content:
        "We may share data with payment processors, mobile network operators, employers (for salary-backed products), credit bureaus, auditors, legal advisers, and regulators when necessary. All third parties are required to handle data securely and only for specified purposes.",
    },
    {
      title: "7. Data Retention",
      content:
        "We retain personal data for as long as needed to provide services, meet legal and regulatory record-keeping requirements, and resolve disputes. Loan records are typically retained for the period required by applicable law after account closure.",
    },
    {
      title: "8. Security",
      content:
        "We implement technical and organisational measures including encryption in transit, access controls, and staff training to protect your information. No method of transmission over the internet is completely secure; we encourage you to use strong passwords and protect your login credentials.",
    },
    {
      title: "9. Your Rights",
      content:
        "Under the Data Protection Act, 2021, you may have the right to access, correct, or request deletion of your personal data (subject to legal exceptions), object to certain processing, and lodge a complaint with the Office of the Data Protection Commissioner. Contact us to exercise these rights.",
    },
    {
      title: "10. Cookies & Analytics",
      content:
        "Our website may use cookies and similar technologies to improve functionality, remember preferences, and understand how visitors use our pages. You can manage cookie settings through your browser.",
    },
    {
      title: "11. Changes to This Policy",
      content:
        "We may update this Privacy Policy from time to time. Material changes will be posted on this page with an updated effective date. Continued use of our services after changes constitutes acceptance of the revised policy.",
    },
    {
      title: "12. Contact Us",
      content: `For privacy-related enquiries, contact our Data Protection contact at ${email} or write to us at ${address}. Please include sufficient detail for us to verify your identity before responding to access requests.`,
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
                Privacy <span className="text-gradient">Policy</span>
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
                This policy applies to {companyName} and its digital services. By using our website or borrower application, you acknowledge that you have read and understood this Privacy Policy.
              </p>

              {sections.map((section) => (
                <div key={section.title}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{section.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              ))}

              <p className="text-sm text-muted-foreground pt-4 border-t border-border">
                See also our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms &amp; Conditions
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
