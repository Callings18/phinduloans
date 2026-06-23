import { Badge } from "@phinduloans/shared/components/ui/badge";
import { FlaskConical } from "lucide-react";

interface BetaBadgeProps {
  className?: string;
}

const BetaBadge = ({ className }: BetaBadgeProps) => {
  return (
    <Badge
      variant="outline"
      className={`ml-1.5 shrink-0 border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-wide px-1.5 py-0 h-5 gap-0.5 ${className ?? ""}`}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Beta
    </Badge>
  );
};

export { BetaBadge };
export default BetaBadge;
