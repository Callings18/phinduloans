import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  const profileCompletion = (() => {
    let score = 35;
    if (profile?.full_name) score += 20;
    if (profile?.phone) score += 15;
    if (profile?.address || profile?.city) score += 10;
    if (kycVerified) score += 20;
    return Math.min(100, score);
  })();

  const menuItems = [
    { icon: User, label: "Personal Information", to: "/profile", desc: "Name, NRC, phone number, address" },
    { icon: FileText, label: "My Documents", to: "/profile?tab=documents", desc: "KYC uploads & document vault" },
    { icon: Shield, label: "Security", to: "/profile?tab=security", desc: "Password & active sessions" },
    { icon: Bell, label: "Notifications", to: "/profile?tab=notifications", desc: "Alert & notification preferences" },
  ];

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card className="border-border/60 shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0">
              {(profile?.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground">{profile?.full_name || "User"}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} />
                  {user?.email}
                </span>
                {profile?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} />
                    {profile.phone}
                  </span>
                )}
              </div>
              <div className="mt-2">
                {kycVerified ? (
                  <Badge className="bg-success/20 text-success border-success/30 border rounded-full px-2.5">
                    <CheckCircle size={12} className="mr-1" /> KYC Verified
                  </Badge>
                ) : (
                  <Badge className="bg-warning/20 text-warning border-warning/30 border rounded-full px-2.5">
                    <AlertTriangle size={12} className="mr-1" /> KYC Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="text-foreground font-medium">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
            <p className="text-[11px] text-muted-foreground">
              Complete your profile and KYC details to speed up approvals and support.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link key={item.label} to={item.to}>
            <Card className="border-border/60 hover:border-primary/40 transition-colors cursor-pointer h-full shadow-card">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <item.icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full md:w-auto"
        onClick={onSignOut}
      >
        <LogOut size={16} className="mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
