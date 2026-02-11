import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import phinduLogo from "@/assets/phindu-logo-white.png";

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
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { name: "Home", path: "/" },
                { name: "Apply Now", path: "/apply" },
                { name: "Calculator", path: "/calculator" },
                { name: "About Us", path: "/about-us" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-muted-foreground text-sm hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Legal</h4>
            <ul className="space-y-2">
              {["Privacy Policy", "Terms of Service", "Loan Agreement", "Data Protection"].map((link) => (
                <li key={link}>
                  <Link
                    to="#"
                    className="text-muted-foreground text-sm hover:text-primary transition-colors"
                  >
                    {link}
                  </Link>
                </li>
              ))}
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
