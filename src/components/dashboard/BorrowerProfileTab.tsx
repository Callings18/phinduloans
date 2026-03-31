import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Phone,
  FileText,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface Props {
  user: any;
  profile: any;
  kycVerified: boolean;
  onSignOut: () => void;
}

export default function BorrowerProfileTab({ user, profile, kycVerified, onSignOut }: Props) {
  const menuItems = [
    { icon: User, label: "Personal Information", to: "/profile", desc: "Name, NRC, phone" },
    { icon: FileText, label: "My Documents", to: "/profile?tab=documents", desc: "KYC uploads & vault" },
    { icon: Shield, label: "Security", to: "/profile?tab=security", desc: "Password & sessions" },
    { icon: Bell, label: "Notifications", to: "/profile?tab=notifications", desc: "Alert preferences" },
  ];

  return (
    <div className="space-y-4">
      {/* User Info */}
      <Card className="glass border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
              {(profile?.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground truncate">{profile?.full_name || "User"}</h2>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {kycVerified ? (
                  <Badge className="bg-success/20 text-success border-success/30 border text-[10px]">
                    <CheckCircle size={8} className="mr-0.5" /> Verified
                  </Badge>
                ) : (
                  <Badge className="bg-warning/20 text-warning border-warning/30 border text-[10px]">
                    <AlertTriangle size={8} className="mr-0.5" /> KYC Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <div className="space-y-1.5">
        {menuItems.map((item) => (
          <Link key={item.label} to={item.to}>
            <Card className="glass border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <item.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={onSignOut}
      >
        <LogOut size={16} className="mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
