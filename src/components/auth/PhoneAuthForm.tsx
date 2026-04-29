import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "./OTPInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, ArrowRight, Loader2, ArrowLeft, Mail, Lock, User } from "lucide-react";
import { z } from "zod";

const phoneSchema = z.string()
  .min(9, "Phone number must be at least 9 digits")
  .regex(/^[\d\s+()-]+$/, "Invalid phone number format");

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
});

type AuthMode = 'phone_input' | 'otp_verify' | 'complete_signup';
type AuthPurpose = 'signup' | 'login';

interface PhoneAuthFormProps {
  purpose: AuthPurpose;
  onSuccess: (userId?: string) => void;
  onSwitchToEmail?: () => void;
}

export const PhoneAuthForm = ({ purpose, onSuccess, onSwitchToEmail }: PhoneAuthFormProps) => {
  const [mode, setMode] = useState<AuthMode>('phone_input');
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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

    const errorWithMessage = error as { message?: string; context?: { json?: () => Promise<{ error?: string; message?: string }> } };
    const context = errorWithMessage.context;
    if (context?.json) {
      try {
        const payload = await context.json();
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
      } catch {
        // ignore context parse issues and fall back to message
      }
    }

    return errorWithMessage.message || fallback;
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
        const parsedMessage = await parseInvokeError(error);
        throw new Error(parsedMessage);
      }
      if (!data?.success) throw new Error(data?.error || "Failed to send OTP");

      toast.success("OTP sent to your phone!");
      setMode('otp_verify');
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
      const body: any = { phone, code: otp, purpose };
      
      // For signup with password, include additional fields
      if (purpose === 'signup' && email && password && fullName) {
        body.email = email;
        body.password = password;
        body.fullName = fullName;
      }

      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Verification failed");

      if (purpose === 'signup' && !email) {
        // Phone verified, now collect email/password
        toast.success("Phone verified! Please complete your registration.");
        setMode('complete_signup');
      } else if (purpose === 'login' && data.magicLink) {
        // Redirect to magic link
        toast.success("Login successful!");
        window.location.href = data.magicLink;
      } else {
        toast.success(purpose === 'signup' ? "Account created!" : "Verified!");
        onSuccess(data.userId);
      }
    } catch (error: any) {
      toast.error(error.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    try {
      signupSchema.parse({ email, password, fullName });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { 
          phone, 
          code: otp, 
          purpose: 'signup',
          email,
          password,
          fullName,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Signup failed");

      toast.success("Account created successfully!");
      onSuccess(data.userId);
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
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
    if (mode === 'complete_signup') {
      setMode('otp_verify');
    } else if (mode === 'otp_verify') {
      setMode('phone_input');
      setOtp("");
    }
  };

  if (mode === 'phone_input') {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium text-foreground">
            Phone Number
          </Label>
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
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone}</p>
          )}
          <p className="text-xs text-muted-foreground">
            We'll send a verification code to this number via SMS
          </p>
        </div>

        <Button
          onClick={handleSendOTP}
          variant="hero"
          className="w-full h-12 text-base"
          disabled={isLoading || !phone}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending OTP...</span>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              Send Verification Code
              <ArrowRight size={18} />
            </span>
          )}
        </Button>

        {onSwitchToEmail && (
          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToEmail}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Use email & password instead
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'otp_verify') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Enter Verification Code</h3>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium text-foreground">{phone}</span>
          </p>
        </div>

        <OTPInput
          value={otp}
          onChange={setOtp}
          disabled={isLoading}
        />

        <Button
          onClick={handleVerifyOTP}
          variant="hero"
          className="w-full h-12 text-base"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              Verify Code
              <ArrowRight size={18} />
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
              Resend Code
            </button>
          )}
        </div>
      </div>
    );
  }

  // Complete signup form
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Complete Your Registration</h3>
        <p className="text-sm text-muted-foreground">
          Phone verified! Now set up your account.
        </p>
      </div>

      <div className="space-y-4">
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

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11"
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11"
            />
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>
      </div>

      <Button
        onClick={handleCompleteSignup}
        variant="hero"
        className="w-full h-12 text-base"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating Account...</span>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            Create Account
            <ArrowRight size={18} />
          </span>
        )}
      </Button>
    </div>
  );
};
