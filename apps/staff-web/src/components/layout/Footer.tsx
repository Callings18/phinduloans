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

            {/* App store badges */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Get the app
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={borrowerAppPath("/auth")}
                  aria-label="Download Android APK"
                  className="flex items-center gap-2 bg-foreground text-background rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                    <path fill="#34A853" d="M3 20.5V3.5c0-.6.3-1 .8-1.3l11.7 9.8L3.8 21.8c-.5-.3-.8-.7-.8-1.3z" />
                    <path fill="#FBBC04" d="M17.6 14.4l-2.6-2.4 2.6-2.4 3.5 2c.7.4.7 1.4 0 1.8l-3.5 2z" />
                    <path fill="#EA4335" d="M15 12l-11.2 9.8c.4.2.9.2 1.3-.1L17.6 14.4 15 12z" />
                    <path fill="#4285F4" d="M15 12l2.6-2.4L5.1 2.3c-.4-.3-.9-.3-1.3-.1L15 12z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <p className="text-[9px] opacity-80">Get it on</p>
                    <p className="text-xs font-semibold">Google Play</p>
                  </div>
                </a>
                <a
                  href={borrowerAppPath("/auth")}
                  aria-label="iOS install instructions"
                  className="flex items-center gap-2 bg-foreground text-background rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-background" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3-.79.83-2.07 1.47-3.12 1.39-.13-1.1.41-2.24 1.13-3 .82-.86 2.21-1.5 3.2-1.39zM20.5 17.34c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.13 3.51-1.55.02-1.95-1.01-4.06-1-2.11.01-2.55 1.02-4.1 1-1.74-.02-3.07-1.77-4.06-3.33-2.78-4.32-3.07-9.52-1.09-12.27 1.41-1.96 3.65-3.11 5.75-3.11 2.13 0 3.47 1.17 5.23 1.17 1.71 0 2.75-1.17 5.21-1.17 1.86 0 3.83 1.01 5.23 2.76-4.6 2.52-3.85 9.09-2.27 8.48z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <p className="text-[9px] opacity-80">Download on the</p>
                    <p className="text-xs font-semibold">App Store</p>
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
