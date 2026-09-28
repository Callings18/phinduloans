import { Badge } from "@phinduloans/shared/components/ui/badge";

interface BetaBadgeProps {
  className?: string;
}

/** Small status chip for modules still in controlled pilot rollout. */
const BetaBadge = ({ className }: BetaBadgeProps) => {
  return (
    <Badge
      variant="outline"
      className={`ml-1.5 shrink-0 border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-wide px-1.5 py-0 h-5 ${className ?? ""}`}
    >
      Pilot
    </Badge>
  );
};

export { BetaBadge };
export default BetaBadge;
