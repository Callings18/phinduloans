import { useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BORROWER_GOOGLE_SIGNUP_CONSENT_KEY,
  isBorrowerGoogleOAuthEnabled,
} from "@phinduloans/shared/config/borrowerOAuth";
import { startBorrowerGoogleOAuth } from "@phinduloans/shared/utils/borrowerGoogleAuth";
import {
  getMarketingPrivacyUrl,
  getMarketingTermsUrl,
} from "@phinduloans/shared/constants/borrowerLegal";

type BorrowerGoogleAuthButtonProps = {
  purpose: "login" | "signup";
  nextPath?: string | null;
  /** Renders inside auth card (mockup layout). */
  embedded?: boolean;
  /** Signup: terms checkbox lives on phone form (single consent row). */
  externalTermsAccepted?: boolean;
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden width={20} height={20}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function BorrowerGoogleAuthSection({
  purpose,
  nextPath,
  embedded = false,
  externalTermsAccepted,
}: BorrowerGoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const googleOAuthEnabled = isBorrowerGoogleOAuthEnabled();

  const termsOk = purpose === "login" || (externalTermsAccepted ?? acceptTerms);

  const handleGoogle = async () => {
    if (purpose === "signup" && !termsOk) {
      setTermsError("Accept the Terms of Service and Privacy Policy above to continue with Google");
      return;
    }
    setTermsError(null);
    setIsLoading(true);
    try {
      if (purpose === "signup") {
        sessionStorage.setItem(BORROWER_GOOGLE_SIGNUP_CONSENT_KEY, "1");
      } else {
        sessionStorage.removeItem(BORROWER_GOOGLE_SIGNUP_CONSENT_KEY);
      }
      const { error } = await startBorrowerGoogleOAuth(nextPath);
      if (error) {
        sessionStorage.removeItem(BORROWER_GOOGLE_SIGNUP_CONSENT_KEY);
        throw error;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not start Google sign-in. Check that Google is enabled in Supabase Auth.";
      toast.error(message);
      setIsLoading(false);
    }
  };

  return (
    <div className={embedded ? "space-y-4 pt-2" : "space-y-4 mt-6"}>
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Or continue with
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {purpose === "signup" && !embedded && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Checkbox
              id="google-terms"
              checked={acceptTerms}
              onCheckedChange={(v) => {
                setAcceptTerms(v === true);
                if (v === true) setTermsError(null);
              }}
              className="mt-0.5"
            />
            <label htmlFor="google-terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              I agree to the{" "}
              <a
                href={getMarketingTermsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href={getMarketingPrivacyUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Privacy Policy
              </a>
            </label>
          </div>
          {termsError && (
            <p className="text-sm text-destructive" role="alert">
              {termsError}
            </p>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 rounded-xl bg-background font-medium"
        disabled={!googleOAuthEnabled || isLoading || (purpose === "signup" && !termsOk)}
        onClick={() => void handleGoogle()}
        aria-describedby={!googleOAuthEnabled ? "google-coming-soon" : undefined}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Redirecting to Google…
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <GoogleMark />
            Continue with Google
          </span>
        )}
      </Button>
      {!googleOAuthEnabled && (
        <p id="google-coming-soon" className="text-center text-xs text-muted-foreground">
          Coming soon
        </p>
      )}
    </div>
  );
}
