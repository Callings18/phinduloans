import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { OTPInput } from "./OTPInput";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2, ArrowLeft, CreditCard, Phone } from "lucide-react";
import { z } from "zod";
import { normalizePhoneToE164, completeBorrowerSessionFromOtpToken } from "@phinduloans/shared/utils/authHelpers";
import { borrowerAppPath } from "@phinduloans/shared/config/siteMode";
import {
  formatZambianMobileDisplay,
  isValidZambianMobile,
  parseZambianMobileInput,
} from "@phinduloans/shared/utils/zambianPhone";
import {
  getMarketingPrivacyUrl,
  getMarketingTermsUrl,
} from "@phinduloans/shared/constants/borrowerLegal";
import { recordBorrowerTermsConsent } from "@phinduloans/shared/utils/borrowerConsent";

const formatNrc = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8, 9)].filter(Boolean);
  return parts.join("/");
};

const nrcSchema = z.string().trim().regex(/^\d{6}\/\d{2}\/\d$/, "NRC must be in the format 123456/78/9");

type AuthMode = "signup_details" | "phone_login" | "otp_verify";
type AuthPurpose = "signup" | "login";

interface PhoneAuthFormProps {
  purpose: AuthPurpose;
  onSuccess: (userId?: string) => void;
  oauthSlot?: (ctx: { termsAccepted: boolean }) => ReactNode;
}

function SignupStepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Step {step} of 2 · {step === 1 ? "Your details" : "Verify your phone"}
      </p>
      <div className="flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                step >= n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 text-muted-foreground bg-muted/30"
              }`}
            >
              {n}
            </div>
            {n === 1 && (
              <div className={`h-0.5 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZambiaPhoneField({
  id,
  value,
  onChange,
  error,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (localDigits: string) => void;
  error?: string;
  describedBy?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Mobile number</Label>
      <div className="flex rounded-xl border border-input bg-background/80 overflow-hidden focus-within:ring-2 focus-within:ring-ring">
        <div className="flex items-center gap-1.5 px-3 border-r border-border bg-muted/40 text-sm text-muted-foreground shrink-0">
          <span aria-hidden>🇿🇲</span>
          <span className="font-medium text-foreground">+260</span>
        </div>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="97X XXX XXX"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="border-0 focus-visible:ring-0 h-12 rounded-none"
          value={formatZambianMobileDisplay(value)}
          onChange={(e) => onChange(parseZambianMobileInput(e.target.value))}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const PhoneAuthForm = ({ purpose, onSuccess, oauthSlot }: PhoneAuthFormProps) => {
  const [mode, setMode] = useState<AuthMode>(purpose === "signup" ? "signup_details" : "phone_login");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [nrcNumber, setNrcNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const phoneE164 = phoneLocal ? normalizePhoneToE164(phoneLocal) : "";

  const sanitizeAuthError = (message: string): string => {
    const compact = message.replace(/\s+/g, "");
    if (/^\+?260\d{9}$/.test(compact)) {
      return "Could not complete phone verification. Please try again or contact support.";
    }
    if (/edge function/i.test(message) || /non-2xx/i.test(message)) {
      return "SMS service is temporarily unavailable. Please try again in a moment.";
    }
    return message;
  };

  const parseInvokeError = async (error: unknown): Promise<string> => {
    const fallback = "Failed to send OTP";
    if (!error || typeof error !== "object") return fallback;
    const e = error as { message?: string; context?: { json?: () => Promise<{ error?: string; message?: string }> } };
    if (e.context?.json) {
      try {
        const payload = await e.context.json();
        if (payload?.error) return sanitizeAuthError(payload.error);
        if (payload?.message) return sanitizeAuthError(payload.message);
      } catch {
        // ignore
      }
    }
    return sanitizeAuthError(e.message || fallback);
  };

  const validatePhone = (): boolean => {
    if (!phoneLocal || phoneLocal.length < 9) {
      setErrors((e) => ({ ...e, phone: "Enter your 9-digit mobile number" }));
      return false;
    }
    if (!isValidZambianMobile(phoneLocal)) {
      setErrors((e) => ({ ...e, phone: "Enter a valid Zambian mobile number (e.g. 97X XXX XXX)" }));
      return false;
    }
    setErrors((e) => {
      const next = { ...e };
      delete next.phone;
      return next;
    });
    return true;
  };

  const handleSendOTP = async () => {
    if (!validatePhone()) return;

    const newErrors: Record<string, string> = {};
    if (purpose === "signup") {
      try {
        nrcSchema.parse(nrcNumber);
      } catch (error) {
        if (error instanceof z.ZodError) newErrors.nrc = error.errors[0].message;
      }
      if (!acceptTerms) {
        newErrors.terms = "You must accept the Terms of Service and Privacy Policy to continue";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }
    setErrors({});

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: phoneE164, purpose },
      });
      if (error) throw new Error(await parseInvokeError(error));
      if (!data?.success) throw new Error(sanitizeAuthError(data?.error || "Failed to send OTP"));

      toast.success("Verification code sent via SMS");
      setMode("otp_verify");
      setCountdown(60);
    } catch (error: unknown) {
      const message = error instanceof Error ? sanitizeAuthError(error.message) : "Failed to send OTP";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { phone: phoneE164, code: otp, purpose };
      if (purpose === "signup") {
        body.nrcNumber = nrcNumber;
      }

      const { data, error } = await supabase.functions.invoke("verify-otp", { body });
      if (error) throw new Error(await parseInvokeError(error));
      if (!data?.success) throw new Error(sanitizeAuthError(data?.error || "Verification failed"));

      if (data.tokenHash) {
        const { error: sessionError } = await completeBorrowerSessionFromOtpToken(data.tokenHash);
        if (sessionError) throw sessionError;

        if (purpose === "signup") {
          const {
            data: { user: sessionUser },
          } = await supabase.auth.getUser();
          const consentUserId = (sessionUser?.id ?? data.userId) as string | undefined;
          if (consentUserId) {
            const { error: consentError } = await recordBorrowerTermsConsent(consentUserId);
            if (consentError) {
              console.warn("Consent log failed:", consentError.message);
            }
          }
        }

        toast.success(purpose === "signup" ? "Account created!" : "Welcome back!");
        onSuccess(data.userId as string | undefined);
        return;
      }

      if (data.magicLink) {
        try {
          const url = new URL(data.magicLink as string);
          url.searchParams.set("redirect_to", borrowerAppPath("/dashboard"));
          window.location.replace(url.toString());
          return;
        } catch {
          // fall through
        }
      }

      toast.success(purpose === "signup" ? "Account created!" : "Verified!");
      onSuccess(data.userId as string | undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? sanitizeAuthError(error.message) : "Verification failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (countdown > 0) return;
    setOtp("");
    void handleSendOTP();
  };

  const handleBack = () => {
    if (mode === "otp_verify") {
      setMode(purpose === "signup" ? "signup_details" : "phone_login");
      setOtp("");
    }
  };

  if (mode === "signup_details") {
    return (
      <div className="glass rounded-3xl p-6 sm:p-8 shadow-card border border-border/50">
        <SignupStepHeader step={1} />
        <div className="space-y-5">
          <ZambiaPhoneField
            id="signup-phone"
            value={phoneLocal}
            onChange={setPhoneLocal}
            error={errors.phone}
            describedBy={errors.phone ? "signup-phone-error" : undefined}
          />

          <div className="space-y-2">
            <Label htmlFor="nrc">NRC number</Label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} aria-hidden />
              <Input
                id="nrc"
                inputMode="numeric"
                placeholder="123456/78/9"
                aria-invalid={Boolean(errors.nrc)}
                value={nrcNumber}
                onChange={(e) => setNrcNumber(formatNrc(e.target.value))}
                className="pl-11 h-12 rounded-xl"
              />
            </div>
            {errors.nrc && (
              <p className="text-sm text-destructive" role="alert">
                {errors.nrc}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Just type the digits — slashes are added automatically</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(v === true)}
                aria-describedby="terms-desc"
                className="mt-0.5"
              />
              <label htmlFor="terms" id="terms-desc" className="text-sm text-muted-foreground leading-snug cursor-pointer">
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
            {errors.terms && (
              <p className="text-sm text-destructive" role="alert">
                {errors.terms}
              </p>
            )}
          </div>

          <Button
            onClick={() => void handleSendOTP()}
            variant="hero"
            className="w-full h-12 text-base rounded-xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Sending code…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Verify phone number <ArrowRight size={18} aria-hidden />
              </span>
            )}
          </Button>
          {oauthSlot?.({ termsAccepted: acceptTerms })}
        </div>
      </div>
    );
  }

  if (mode === "phone_login") {
    return (
      <div className="glass rounded-3xl p-6 sm:p-8 shadow-card border border-border/50">
        <div className="space-y-5">
          <ZambiaPhoneField
            id="login-phone"
            value={phoneLocal}
            onChange={setPhoneLocal}
            error={errors.phone}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            We will send a one-time code by SMS. Standard message rates may apply.
          </p>
          <Button
            onClick={() => void handleSendOTP()}
            variant="hero"
            className="w-full h-12 text-base rounded-xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue <ArrowRight size={18} />
              </span>
            )}
          </Button>
          {oauthSlot?.({ termsAccepted: true })}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 shadow-card border border-border/50">
      {purpose === "signup" && <SignupStepHeader step={2} />}
      <div className="space-y-5">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} aria-hidden /> Back
        </button>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Enter verification code</h2>
          <p className="text-sm text-muted-foreground">
            Code sent to <span className="font-medium text-foreground">{phoneE164}</span>
          </p>
        </div>

        <OTPInput value={otp} onChange={setOtp} disabled={isLoading} />

        <Button
          onClick={() => void handleVerifyOTP()}
          variant="hero"
          className="w-full h-12 text-base rounded-xl"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {purpose === "signup" ? "Complete registration" : "Sign in"} <ArrowRight size={18} />
            </span>
          )}
        </Button>

        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-sm text-muted-foreground">
              Resend code in <span className="font-medium text-foreground">{countdown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResendOTP}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Resend code
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
