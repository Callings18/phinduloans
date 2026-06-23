import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type QueryStateViewProps = {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  /** Rendered only when not loading, not error, and hasData is true */
  children?: ReactNode;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
  className?: string;
};

const baseClassName = "flex h-full items-center justify-center text-center text-sm text-muted-foreground px-4";

export default function QueryStateView({
  isLoading,
  isError,
  hasData,
  children,
  loadingText = "Loading data...",
  errorText = "Data could not be loaded.",
  emptyText = "No data available.",
  className,
}: QueryStateViewProps) {
  const viewClassName = className ? `${baseClassName} ${className}` : baseClassName;

  if (isLoading) {
    return (
      <div className={viewClassName}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{loadingText}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className={viewClassName}>{errorText}</div>;
  }

  if (!hasData) {
    return <div className={viewClassName}>{emptyText}</div>;
  }

  return <>{children ?? null}</>;
}
