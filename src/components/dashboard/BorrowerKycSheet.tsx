import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ProfileDocumentVault from "@/components/dashboard/ProfileDocumentVault";
import KYCFinancialInfo from "@/components/dashboard/KYCFinancialInfo";
import KYCNextOfKin from "@/components/dashboard/KYCNextOfKin";
import KYCReferences from "@/components/dashboard/KYCReferences";

type BorrowerKycSheetProps = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * In-dashboard KYC workspace (slide-over). Keeps borrowers on the dashboard
 * instead of navigating to /profile for documents and payout details.
 */
export default function BorrowerKycSheet({ userId, open, onOpenChange }: BorrowerKycSheetProps) {
  if (!userId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="borrower-kyc-sheet"
        className="flex h-full w-full max-w-full flex-col gap-0 border-border p-0 sm:max-w-xl"
      >
        <div className="shrink-0 border-b border-border px-6 pb-4 pt-6 pr-14">
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle>KYC & payout</SheetTitle>
            <SheetDescription>
              Upload identity documents and add payout details here. You can close this panel anytime — your progress is
              saved automatically.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="space-y-6 pb-4">
            <ProfileDocumentVault userId={userId} />
            <KYCFinancialInfo userId={userId} />
            <KYCNextOfKin userId={userId} />
            <KYCReferences userId={userId} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background/95 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="hero" className="w-full" data-testid="borrower-kyc-sheet-done" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
