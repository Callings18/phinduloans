import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@phinduloans/shared/components/ui/button";
import { ArrowRight, Mail, MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { useSystemSettings } from "@phinduloans/shared/hooks/useSystemSettings";
import { borrowerAppPath } from "@/config/publicUrls";
import { Link } from "react-router-dom";

const Contact = () => {
  const { data: settings } = useSystemSettings();
  const companyInfo = settings?.companyInfo;
  const companyName = companyInfo?.name || "Phindu Credit Solutions";
  const phone =
    !companyInfo?.support_phone || companyInfo.support_phone.includes("XXX")
      ? "+260 967 713 001"
      : companyInfo.support_phone;
  const email =
    !companyInfo?.support_email || companyInfo.support_email.includes("placeholder")
      ? "info@phindu.com"
      : companyInfo.support_email;
  const address = companyInfo?.address || "Lusaka, Zambia";

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
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Get in <span className="text-gradient">Touch</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                We&apos;re here to help with loan enquiries, account support, and general questions about {companyName}.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-8 md:p-10 space-y-8">
                <h2 className="text-2xl font-bold text-foreground">Contact Details</h2>

                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <Phone className="text-primary-foreground" size={22} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Phone</p>
                      <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-muted-foreground hover:text-primary transition-colors">
                        {phone}
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <Mail className="text-primary-foreground" size={22} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Email</p>
                      <a href={`mailto:${email}`} className="text-muted-foreground hover:text-primary transition-colors">
                        {email}
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <MapPin className="text-primary-foreground" size={22} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Office</p>
                      <p className="text-muted-foreground">{address}</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      <Clock className="text-primary-foreground" size={22} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Business Hours</p>
                      <p className="text-muted-foreground">Monday – Friday: 08:00 – 17:00</p>
                      <p className="text-muted-foreground text-sm">Saturday: 09:00 – 13:00 (by appointment)</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div className="glass rounded-3xl p-8 md:p-10">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageCircle className="text-primary" size={24} />
                    <h2 className="text-2xl font-bold text-foreground">Borrower Support</h2>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    For loan applications, repayments, and account queries, sign in to the borrower portal for the fastest response and real-time updates.
                  </p>
                  <Button variant="hero" size="lg" className="w-full" asChild>
                    <a href={borrowerAppPath("/auth")}>
                      Sign In to Borrower App
                      <ArrowRight size={20} />
                    </a>
                  </Button>
                </div>

                <div className="glass rounded-3xl p-8 md:p-10">
                  <h2 className="text-xl font-bold text-foreground mb-3">New to Phindu?</h2>
                  <p className="text-muted-foreground mb-6">
                    Explore our loan products, use the calculator, or create an account to apply in minutes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to="/loan-products">View Products</Link>
                    </Button>
                    <Button variant="hero" className="flex-1" asChild>
                      <a href={borrowerAppPath("/auth?mode=signup")}>
                        Get Started
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
                  <p>
                    {companyName} is licensed by the Bank of Zambia. For complaints or regulatory enquiries, please email{" "}
                    <a href={`mailto:${email}`} className="text-primary hover:underline">
                      {email}
                    </a>{" "}
                    with your full name and loan reference (if applicable).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
