import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { useSystemSettings } from "@phinduloans/shared/hooks/useSystemSettings";
import { borrowerAppPath } from "@/config/publicUrls";
const phinduLogo = "/icons/icon-512.png";

const Footer = () => {
  const { data: settings } = useSystemSettings();
  const companyInfo = settings?.companyInfo;

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <img
              src={phinduLogo}
              alt="Phindu Credit Solutions"
              className="h-12 object-contain invert dark:invert-0"
            />
            <p className="text-muted-foreground text-sm">
              Money when you need it. Fast, secure, and transparent lending solutions for Zambia.
            </p>

            {/* Borrower app entry — install UX lives on app.phindu.com only */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Borrower app
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={borrowerAppPath("/auth")}
                  className="flex items-center gap-2 bg-foreground text-background rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
                >
                  <div className="text-left leading-tight">
                    <p className="text-[9px] opacity-80">Open on web</p>
                    <p className="text-xs font-semibold">Login / Sign up</p>
                  </div>
                </a>
                <a
                  href={borrowerAppPath("/install")}
                  className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-left leading-tight">
                    <p className="text-[9px] text-muted-foreground">Optional</p>
                    <p className="text-xs font-semibold text-foreground">Download APK</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { name: "Home", path: "/" },
                { name: "Loan Products", path: "/loan-products" },
                { name: "Apply Now", path: borrowerAppPath("/auth?mode=signup") },
                { name: "Calculator", path: "/calculator" },
                { name: "About Us", path: "/about-us" },
                { name: "FAQ", path: "/faq" },
                { name: "Contact", path: "/contact" },
              ].map((link) => (
                <li key={link.name}>
                  <a
                    href={link.path}
                    className="text-muted-foreground text-sm hover:text-primary transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Licensed by the Bank of Zambia</li>
              <li>Data Protection — DPA 2021 compliant</li>
              <li>
                <Link to="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-primary transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@phindu.com"
                  className="hover:text-primary transition-colors"
                >
                  Request loan agreement template
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-muted-foreground text-sm">
                <Phone size={16} className="text-primary" />
                {(!companyInfo?.support_phone || companyInfo?.support_phone.includes('XXX'))
                  ? "+260 967 713 001"
                  : companyInfo?.support_phone}
              </li>
              <li className="flex items-center gap-3 text-muted-foreground text-sm">
                <Mail size={16} className="text-primary" />
                {(!companyInfo?.support_email || companyInfo?.support_email.includes('phindu.com'))
                  ? "info@phindu.com"
                  : companyInfo?.support_email}
              </li>
              <li className="flex items-start gap-3 text-muted-foreground text-sm">
                <MapPin size={16} className="text-primary mt-0.5" />
                {companyInfo?.address || "Lusaka, Zambia"}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {companyInfo?.name || "Phindu Credit Solutions"}. All rights reserved.
          </p>
          <p className="text-muted-foreground text-xs">
            Licensed by the Bank of Zambia
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
