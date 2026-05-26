import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "./OTPInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, ArrowRight, Loader2, ArrowLeft, User } from "lucide-react";
import { z } from "zod";

const phoneSchema = z.string()
  .min(9, "Phone number must be at least 9 digits")
  .regex(/^[\d\s+()-]+$/, "Invalid phone number format");

const fullNameSchema = z.string().trim().min(2, "Full name is required");

type AuthMode = "phone_input" | "name_input" | "otp_verify";
type AuthPurpose = "signup" | "login";

interface PhoneAuthFormProps {
  purpose: AuthPurpose;
  onSuccess: (userId?: string) => void;
}

export const PhoneAuthForm = ({ purpose, onSuccess }: PhoneAuthFormProps) => {
  // Signup flow: name_input -> phone_input -> otp_verify
  // Login flow:  phone_input -> otp_verify
  const [mode, setMode] = useState<AuthMode>(purpose === "signup" ? "name_input" : "phone_input");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
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

  const parseInvokeError = async (error: unknown): Promise<string> => {
    const fallback = "Failed to send OTP";
    if (!error || typeof error !== "object") return fallback;
    const e = error as { message?: string; context?: { json?: () => Promise<{ error?: string; message?: string }> } };
    if (e.context?.json) {
      try {
        const payload = await e.context.json();
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
      } catch {
        // ignore
      }
    }
    return e.message || fallback;
  };

  const handleNameContinue = () => {
    try {
      fullNameSchema.parse(fullName);
      setErrors({});
      setMode("phone_input");
    } catch (error) {
      if (error instanceof z.ZodError) setErrors({ fullName: error.errors[0].message });
    }
  };

  const handleSendOTP = async () => {
    try {
      phoneSchema.parse(phone);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors({ phone: error.errors[0].message });
        return;
      }
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone, purpose },
      });
      if (error) {
        const msg = await parseInvokeError(error);
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error || "Failed to send OTP");

      toast.success("OTP sent to your phone!");
      setMode("otp_verify");
      setCountdown(60);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send OTP";
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
      const body: Record<string, unknown> = { phone, code: otp, purpose };
      if (purpose === "signup") {
        body.fullName = fullName;
      }

      const { data, error } = await supabase.functions.invoke("verify-otp", { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Verification failed");

      if (purpose === "login" && data.magicLink) {
        toast.success("Login successful!");
        window.location.href = data.magicLink;
      } else if (purpose === "signup" && data.magicLink) {
        toast.success("Account created!");
        window.location.href = data.magicLink;
      } else {
        toast.success(purpose === "signup" ? "Account created!" : "Verified!");
        onSuccess(data.userId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verification failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (countdown > 0) return;
    setOtp("");
    handleSendOTP();
  };

  const handleBack = () => {
    if (mode === "otp_verify") {
      setMode("phone_input");
      setOtp("");
    } else if (mode === "phone_input" && purpose === "signup") {
      setMode("name_input");
    }
  };

  if (mode === "name_input") {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="fullName"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-11"
            />
          </div>
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
        </div>
        <Button onClick={handleNameContinue} variant="hero" className="w-full h-12 text-base" disabled={!fullName}>
          <span className="flex items-center gap-2">Continue <ArrowRight size={18} /></span>
        </Button>
      </div>
    );
  }

  if (mode === "phone_input") {
    return (
      <div className="space-y-5">
        {purpose === "signup" && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="phone"
              type="tel"
              placeholder="0971 234 567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-11"
            />
          </div>
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          <p className="text-xs text-muted-foreground">We'll send a verification code via SMS</p>
        </div>
        <Button onClick={handleSendOTP} variant="hero" className="w-full h-12 text-base" disabled={isLoading || !phone}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending OTP...</span>
            </div>
          ) : (
            <span className="flex items-center gap-2">Send Verification Code <ArrowRight size={18} /></span>
          )}
        </Button>
      </div>
    );
  }

  // otp_verify
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Enter Verification Code</h3>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{phone}</span>
        </p>
      </div>

      <OTPInput value={otp} onChange={setOtp} disabled={isLoading} />

      <Button onClick={handleVerifyOTP} variant="hero" className="w-full h-12 text-base" disabled={isLoading || otp.length !== 6}>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying...</span>
          </div>
        ) : (
          <span className="flex items-center gap-2">Verify Code <ArrowRight size={18} /></span>
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
            Resend Code
          </button>
        )}
      </div>
    </div>
  );
};
