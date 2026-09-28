import { Link, useLocation } from "react-router-dom";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@phinduloans/shared/components/ui/dropdown-menu";
const phinduLogo = "/icons/icon-512.png";
import ThemeToggle from "@phinduloans/shared/components/common/ThemeToggle";
import NotificationCenter from "@phinduloans/shared/components/common/NotificationCenter";
import { borrowerAppPath, isOfficeSiteMode, officePath } from "@/config/publicUrls";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isStaff, signOut, isLoading } = useAuth();
  const officeMode = isOfficeSiteMode();
  const staffAdminUrl = officeMode ? "/admin" : officePath("/admin");
  /** Marketing Login always → borrower app; staff use office.phindu.com directly. */
  const loginHref = officeMode ? "/auth" : borrowerAppPath("/auth");

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/loan-products", label: "Products" },
    { href: "/calculator", label: "Calculator" },
    { href: "/about-us", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center group">
              <img
                src={phinduLogo}
                alt="Phindu Credit Solutions"
                className="h-10 object-contain invert dark:invert-0 group-hover:opacity-90 transition-opacity duration-300"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors duration-200 relative group ${isActive(link.href)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {link.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 gradient-primary transition-all duration-300 ${isActive(link.href) ? "w-full" : "w-0 group-hover:w-full"
                    }`} />
                </Link>
              ))}
              {user && isStaff && (
                officeMode ? (
                  <Link
                    to="/admin"
                    className={`text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${location.pathname.startsWith("/admin")
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Shield size={16} className="opacity-80" />
                    Admin
                  </Link>
                ) : (
                  <a
                    href={staffAdminUrl}
                    className={`text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${location.pathname.startsWith("/admin")
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Shield size={16} className="opacity-80" />
                    Admin
                  </a>
                )
              )}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : user ? (
                <>
                  {/* Notification Center */}
                  <NotificationCenter />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                          <User className="text-primary-foreground" size={14} />
                        </div>
                        <span className="max-w-24 truncate">{user.email?.split('@')[0]}</span>
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        {isStaff ? (
                          officeMode ? (
                            <Link to="/admin" className="flex items-center gap-2">
                              <LayoutDashboard size={16} />
                              Admin
                            </Link>
                          ) : (
                            <a href={staffAdminUrl} className="flex items-center gap-2">
                              <LayoutDashboard size={16} />
                              Admin
                            </a>
                          )
                        ) : (
                          <a href={borrowerAppPath("/dashboard")} className="flex items-center gap-2">
                            <LayoutDashboard size={16} />
                            My Dashboard
                          </a>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                        <LogOut size={16} className="mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    {officeMode ? (
                      <Link to="/auth">Staff Login</Link>
                    ) : (
                      <a href={loginHref}>Login</a>
                    )}
                  </Button>
                  {!officeMode && (
                    <Button variant="outline" asChild>
                      <a href={officePath("/auth")}>Staff</a>
                    </Button>
                  )}
                  <Button variant="hero" asChild>
                    <a href={borrowerAppPath("/auth?mode=signup")}>Get Started</a>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle variant="minimal" />
              {user && <NotificationCenter />}
              <button
                className="text-foreground p-2 hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsOpen(!isOpen)}
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className="md:hidden py-4 border-t border-border animate-fade-in">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-sm font-medium py-3 px-4 rounded-lg transition-colors ${isActive(link.href)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:bg-secondary"
                      }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-border">
                  {user ? (
                    <>
                      <Button variant="ghost" asChild className="justify-start">
                        {isStaff ? (
                          officeMode ? (
                            <Link to="/admin" onClick={() => setIsOpen(false)}>
                              <LayoutDashboard size={16} className="mr-2" />
                              Admin
                            </Link>
                          ) : (
                            <a href={staffAdminUrl} onClick={() => setIsOpen(false)}>
                              <LayoutDashboard size={16} className="mr-2" />
                              Admin
                            </a>
                          )
                        ) : (
                          <a href={borrowerAppPath("/dashboard")} onClick={() => setIsOpen(false)}>
                            <LayoutDashboard size={16} className="mr-2" />
                            My Dashboard
                          </a>
                        )}
                      </Button>
                      <Button variant="ghost" onClick={() => { signOut(); setIsOpen(false); }} className="justify-start text-destructive hover:text-destructive">
                        <LogOut size={16} className="mr-2" />
                        Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" asChild>
                        {officeMode ? (
                          <Link to="/auth" onClick={() => setIsOpen(false)}>Staff Login</Link>
                        ) : (
                          <a href={loginHref} onClick={() => setIsOpen(false)}>Login</a>
                        )}
                      </Button>
                      {!officeMode && (
                        <Button variant="outline" asChild>
                          <a href={officePath("/auth")} onClick={() => setIsOpen(false)}>Staff Login</a>
                        </Button>
                      )}
                      <Button variant="hero" asChild>
                        <a href={borrowerAppPath("/auth?mode=signup")} onClick={() => setIsOpen(false)}>Get Started</a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
