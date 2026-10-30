import { cn } from "@phinduloans/shared/lib/utils";
import { Home, CreditCard, Receipt, User } from "lucide-react";

export type BorrowerTab = "home" | "loans" | "apply" | "payments" | "profile";

interface BorrowerBottomNavProps {
  activeTab: BorrowerTab;
  onTabChange: (tab: BorrowerTab) => void;
  badgeCounts?: {
    loans?: number;
    payments?: number;
  };
}

const navTabs: { id: BorrowerTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "loans", label: "Loans", icon: CreditCard },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "profile", label: "Profile", icon: User },
];

export default function BorrowerBottomNav({ activeTab, onTabChange, badgeCounts }: BorrowerBottomNavProps) {
  const displayActive = activeTab === "apply" ? "home" : activeTab;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom" aria-label="Main">
      <div className="max-w-lg mx-auto px-3 pb-2">
        <div className="flex items-center justify-around h-16 px-2 rounded-2xl border border-border/50 shadow-lg bg-card/95 backdrop-blur-md">
          {navTabs.map((tab) => {
            const isActive = displayActive === tab.id;
            const count =
              tab.id === "loans" ? badgeCounts?.loans : tab.id === "payments" ? badgeCounts?.payments : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-all duration-200 relative min-h-[44px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden />
                  {count != null && count > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
