import { AlertTriangle, FileQuestion, Inbox } from "lucide-react";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { cn } from "@phinduloans/shared/lib/utils";

export type LegacyDataVariant = "missing" | "incomplete" | "empty" | "unknown_status";

interface LegacyDataFallbackProps {
  variant?: LegacyDataVariant;
  title?: string;
  description?: string;
  /** Optional remedial CTA */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

const variantConfig: Record<LegacyDataVariant, { icon: typeof AlertTriangle; defaultTitle: string; defaultDescription: string }> = {
  missing: {
    icon: FileQuestion,
    defaultTitle: "Information not available",
    defaultDescription: "This record was created before some fields were tracked. The data may need to be updated by an administrator.",
  },
  incomplete: {
    icon: AlertTriangle,
    defaultTitle: "Some details are missing",
    defaultDescription: "Parts of this record are incomplete. The displayed information may be partial.",
  },
  empty: {
    icon: Inbox,
    defaultTitle: "Nothing to display",
    defaultDescription: "There is no data for this section yet.",
  },
  unknown_status: {
    icon: AlertTriangle,
    defaultTitle: "Status not recognised",
    defaultDescription: "This record uses a legacy status that is no longer in the standard pipeline. Contact support if you need clarity.",
  },
};

/**
 * Defensive fallback used when a record is too sparse / legacy to render
 * normally. Never throws, always renders something the user can read.
 */
export function LegacyDataFallback({
  variant = "missing",
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
}: LegacyDataFallbackProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm",
          className,
        )}
      >
        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{title ?? config.defaultTitle}</p>
          <p className="text-muted-foreground text-xs mt-0.5">{description ?? config.defaultDescription}</p>
        </div>
        {actionLabel && onAction && (
          <Button size="sm" variant="ghost" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-dashed", className)} role="status" aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center text-center py-8 px-6">
        <Icon className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
        <h4 className="font-semibold text-base text-foreground">{title ?? config.defaultTitle}</h4>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {description ?? config.defaultDescription}
        </p>
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default LegacyDataFallback;
