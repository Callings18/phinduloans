import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Download, Smartphone, Share, PlusSquare, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";
import { isStandaloneDisplayMode } from "@/utils/pwaDisplayMode";

const SNOOZE_KEY = "pwa-install-snooze-until";
const REOPEN_INTERVAL_MS = 10_000; // re-show every 10s while not snoozed/installed

const SNOOZE_OPTIONS = [
  { label: "Mute for 1 hour", ms: 60 * 60 * 1000 },
  { label: "Mute for 1 day", ms: 24 * 60 * 60 * 1000 },
  { label: "Mute for 1 week", ms: 7 * 24 * 60 * 60 * 1000 },
];

const isLikelyIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as Window & { MSStream?: unknown }).MSStream;

function isSnoozed(): boolean {
  const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
  return Number.isFinite(until) && until > Date.now();
}

export const PWAInstallPrompt = () => {
  const { deferredPrompt, promptInstall } = usePwaInstallPrompt();
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useToast();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStandaloneDisplayMode()) {
      setShowPrompt(false);
      return;
    }

    const tryShow = () => {
      if (isStandaloneDisplayMode()) {
        setShowPrompt(false);
        return;
      }
      if (isSnoozed()) {
        setShowPrompt(false);
        return;
      }
      // On iOS the browser never fires beforeinstallprompt — still show instructions.
      // On Chromium, only show once we have a deferred prompt OR after the first 10s tick anyway.
      setShowPrompt(true);
    };

    // First nudge after 10s, then re-pop every 10s if user closed without snoozing.
    const firstTimer = window.setTimeout(tryShow, REOPEN_INTERVAL_MS);
    intervalRef.current = window.setInterval(tryShow, REOPEN_INTERVAL_MS);

    return () => {
      window.clearTimeout(firstTimer);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast({
        title: "Use your browser menu",
        description:
          "Open your browser menu (⋮) and tap 'Install app' or 'Add to Home Screen'.",
      });
      return;
    }
    const choice = await promptInstall();
    if (choice?.outcome === "accepted") {
      toast({
        title: "App installing",
        description: "Phindu Loans is being added to your home screen.",
      });
      setShowPrompt(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      // Treat declined as a 1-hour snooze so we don't immediately re-pop.
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_OPTIONS[0].ms));
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    // Plain close = next 10s tick will re-open. Encourages install.
    setShowPrompt(false);
  };

  const handleSnooze = (ms: number, label: string) => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
    setShowPrompt(false);
    toast({
      title: "Install reminder muted",
      description: `We'll stop nudging you ${label.toLowerCase()}.`,
    });
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md animate-slide-up">
      <Card className="relative overflow-hidden border-0 shadow-2xl text-primary-foreground bg-gradient-to-br from-primary via-primary to-[hsl(var(--primary)/0.85)]">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />
        <CardContent className="relative p-5">
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-2 right-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-foreground flex items-center justify-center flex-shrink-0 shadow-lg">
              <img
                src="/icons/icon-512.png"
                alt="Phindu Credit"
                className="w-10 h-10 object-contain"
              />
            </div>

            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <h3 className="font-semibold text-primary-foreground mb-1">
                  Install the Phindu Loans app
                </h3>
                <p className="text-sm text-primary-foreground/85">
                  Apply for loans faster, get push reminders, and use the app offline.
                </p>
              </div>

              {isLikelyIOS && !deferredPrompt ? (
                <ol className="text-xs text-primary-foreground/90 space-y-2">
                  <li className="flex gap-2 items-start">
                    <Share className="shrink-0 mt-0.5" size={14} />
                    <span>
                      Tap <strong>Share</strong> in Safari.
                    </span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <PlusSquare className="shrink-0 mt-0.5" size={14} />
                    <span>
                      Choose <strong>Add to Home Screen</strong>.
                    </span>
                  </li>
                </ol>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1 min-w-[140px] bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Download size={16} className="mr-2" />
                  Install App
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                    >
                      <Clock size={14} className="mr-1" />
                      Mute
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SNOOZE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.label}
                        onClick={() => handleSnooze(opt.ms, opt.label)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-xs text-primary-foreground/80">
                ✓ Works offline • ✓ Faster • ✓ Push notifications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
