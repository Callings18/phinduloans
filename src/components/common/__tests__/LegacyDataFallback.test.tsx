import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LegacyDataFallback } from "../LegacyDataFallback";

describe("<LegacyDataFallback>", () => {
  it("renders default missing variant copy", () => {
    render(<LegacyDataFallback />);
    expect(screen.getByText(/information not available/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it.each([
    ["incomplete" as const, /some details are missing/i],
    ["empty" as const, /nothing to display/i],
    ["unknown_status" as const, /status not recognised/i],
  ])("renders %s variant", (variant, pattern) => {
    render(<LegacyDataFallback variant={variant} />);
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });

  it("uses custom title and description", () => {
    render(<LegacyDataFallback title="Custom title" description="Custom body" />);
    expect(screen.getByText("Custom title")).toBeInTheDocument();
    expect(screen.getByText("Custom body")).toBeInTheDocument();
  });

  it("invokes action callback when CTA clicked", () => {
    const onAction = vi.fn();
    render(<LegacyDataFallback actionLabel="Refresh" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders compact variant with same a11y semantics", () => {
    render(<LegacyDataFallback compact title="Compact" />);
    expect(screen.getByText("Compact")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("never throws when only required defaults are used", () => {
    expect(() => render(<LegacyDataFallback />)).not.toThrow();
  });
});
