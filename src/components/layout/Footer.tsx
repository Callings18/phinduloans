import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const Footer = () => {
  const { data: settings } = useSystemSettings();
  const companyInfo = settings?.companyInfo;

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">{companyInfo?.name.charAt(0) || "P"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-foreground font-bold text-lg leading-tight uppercase">
                  {companyInfo?.name.split(" ")[0] || "PHINDU"}
                </span>
                <span className="text-muted-foreground text-xs tracking-wider uppercase">
                  {companyInfo?.name.split(" ").slice(1).join(" ") || "CREDIT SOLUTIONS"}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Money when you need it. Fast, secure, and transparent lending solutions for Zambia.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold">Quick Links</h4>
            <ul className="space-y-2">
              {["Home", "Apply Now", "Calculator", "About Us", "FAQs"].map((link) => (
                <li key={link}>
                  <Link
                    to={link === "Home" ? "/" : `/${link.toLowerCase().replace(" ", "-")}`}
                    className="text-muted-foreground text-sm hover:text-primary transition-colors"
                  >
                    {link}
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
                    to={`/${link.toLowerCase().replace(" ", "-")}`}
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
                {companyInfo?.support_phone || "+260 XXX XXX XXX"}
              </li>
              <li className="flex items-center gap-3 text-muted-foreground text-sm">
                <Mail size={16} className="text-primary" />
                {companyInfo?.support_email || "info@phinducredit.co.zm"}
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
            © {new Date().getFullYear()} Phindu Credit Solutions. All rights reserved.
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
