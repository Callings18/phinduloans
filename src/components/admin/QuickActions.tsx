import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  UserPlus,
  FileText,
  Banknote,
  ArrowUpRight,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router-dom";

const quickActions = [
  {
    icon: FileText,
    label: "New Application",
    description: "Create loan application",
    path: "/admin/applications?action=new",
    color: "from-primary to-primary/80",
  },
  {
    icon: UserPlus,
    label: "Add Borrower",
    description: "Register new borrower",
    path: "/admin/borrowers?action=new",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Banknote,
    label: "Record Payment",
    description: "Log repayment",
    path: "/admin/repayments?action=new",
    color: "from-warning to-orange-600",
  },
  {
    icon: Smartphone,
    label: "Install our App",
    description: "Android APK & iOS guide",
    path: "/install",
    color: "from-fuchsia-500 to-primary",
  },
];

import { forwardRef } from "react";

const QuickActions = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <Card ref={ref} className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-lg flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.path}
              className="group relative overflow-hidden rounded-xl border border-border/50 p-4 hover:border-primary/50 transition-all duration-300 bg-gradient-to-br from-muted/30 to-transparent hover:from-primary/10"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}
              >
                <action.icon className="text-white" size={18} />
              </div>
              <p className="font-semibold text-foreground text-sm">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              <ArrowUpRight
                size={14}
                className="absolute top-3 right-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

QuickActions.displayName = "QuickActions";

export default QuickActions;
