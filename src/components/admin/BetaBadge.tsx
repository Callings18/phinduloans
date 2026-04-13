import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`ml-1.5 shrink-0 border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-wide px-1.5 py-0 h-5 gap-0.5 ${className ?? ""}`}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Beta
    </Badge>
  );
}
