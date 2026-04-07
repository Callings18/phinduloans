import { cn } from "@/lib/utils";
import { Home, CreditCard, PlusCircle, Receipt, User } from "lucide-react";

export type BorrowerTab = "home" | "loans" | "apply" | "payments" | "profile";

interface BorrowerBottomNavProps {
  activeTab: BorrowerTab;
  onTabChange: (tab: BorrowerTab) => void;
  badgeCounts?: {
    loans?: number;
    payments?: number;
  };
}

const tabs: { id: BorrowerTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "loans", label: "My Loans", icon: CreditCard },
  { id: "apply", label: "Apply", icon: PlusCircle },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "profile", label: "Profile", icon: User },
];

export default function BorrowerBottomNav({ activeTab, onTabChange, badgeCounts }: BorrowerBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "loans" ? badgeCounts?.loans : tab.id === "payments" ? badgeCounts?.payments : undefined;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-all duration-200 relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.id === "apply" ? (
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center -mt-5 shadow-lg transition-all",
                  isActive ? "gradient-primary text-primary-foreground shadow-glow" : "bg-primary/80 text-primary-foreground"
                )}>
                  <tab.icon size={22} />
                </div>
              ) : (
                <div className="relative">
                  <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                  {count && count > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
              )}
              <span className={cn(
                "text-[10px] font-medium",
                tab.id === "apply" && "mt-0.5"
              )}>
                {tab.label}
              </span>
              {isActive && tab.id !== "apply" && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
