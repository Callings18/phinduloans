import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, signOut, isLoading } = useAuth();
  const { data: settings } = useSystemSettings();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/apply", label: "Apply Now" },
    { href: "/calculator", label: "Calculator" },
    { href: "/about-us", label: "About" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const companyName = settings?.companyInfo?.name || "PHINDU";
  const nameParts = companyName.split(" ");
  const firstLetter = companyName.charAt(0);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center group-hover:shadow-glow transition-shadow duration-300">
              <span className="text-primary-foreground font-bold text-xl">{firstLetter}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-foreground font-bold text-lg leading-tight uppercase">{nameParts[0]}</span>
              {nameParts.length > 1 && (
                <span className="text-muted-foreground text-xs tracking-wider uppercase">
                  {nameParts.slice(1).join(" ")}
                </span>
              )}
            </div>
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
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : user ? (
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
                    <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
                      <LayoutDashboard size={16} />
                      {isAdmin ? "Admin Dashboard" : "My Dashboard"}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Login</Link>
                </Button>
                <Button variant="hero" asChild>
                  <Link to="/apply">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2 hover:bg-secondary rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
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
                      <Link to={isAdmin ? "/admin" : "/dashboard"} onClick={() => setIsOpen(false)}>
                        <LayoutDashboard size={16} className="mr-2" />
                        {isAdmin ? "Admin Dashboard" : "My Dashboard"}
                      </Link>
                    </Button>
                    <Button variant="ghost" onClick={() => { signOut(); setIsOpen(false); }} className="justify-start text-destructive hover:text-destructive">
                      <LogOut size={16} className="mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" asChild>
                      <Link to="/auth" onClick={() => setIsOpen(false)}>Login</Link>
                    </Button>
                    <Button variant="hero" asChild>
                      <Link to="/apply" onClick={() => setIsOpen(false)}>Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
