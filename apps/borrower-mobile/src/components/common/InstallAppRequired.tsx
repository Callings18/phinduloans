import { useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Smartphone, Share, PlusSquare, Download } from "lucide-react";
import { isStandaloneDisplayMode } from "@phinduloans/shared/utils/pwaDisplayMode";
import { usePwaInstallPrompt } from "@phinduloans/shared/hooks/usePwaInstallPrompt";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

const isLikelyIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as Window & { MSStream?: unknown }).MSStream;

/**
 * Shown when borrower flows require the installed PWA but the user is in a normal browser tab.
 * Offers a one-tap Install when the browser fires `beforeinstallprompt` (Chrome, Edge, etc.).
 * iOS Safari has no programmatic install — instructions only.
 */
export function InstallAppRequired() {
  const { deferredPrompt, promptInstall } = usePwaInstallPrompt();
  const { toast } = useToast();
  const [installBusy, setInstallBusy] = useState(false);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    setInstallBusy(true);
    try {
      const choice = await promptInstall();
      if (choice?.outcome === "accepted") {
        toast({
          title: "App installing",
          description: "Open Phindu from your home screen when it appears.",
        });
      }
    } finally {
      setInstallBusy(false);
    }
  };

  const canUseInstallButton = Boolean(deferredPrompt) && !isLikelyIOS && !isStandaloneDisplayMode();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full border-primary/30 shadow-lg">
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Smartphone className="text-primary-foreground" size={32} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Install the Phindu app</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Loan applications and new accounts are available in our installable app for a better experience,
              offline-friendly loading, and notifications.
            </p>
          </div>

          {isLikelyIOS && !isStandaloneDisplayMode() ? (
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
              <li className="flex gap-2 items-start">
                <Share className="shrink-0 mt-0.5 text-primary" size={16} />
                <span>
                  Tap the <strong className="text-foreground">Share</strong> button in Safari.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <PlusSquare className="shrink-0 mt-0.5 text-primary" size={16} />
                <span>
                  Choose <strong className="text-foreground">Add to Home Screen</strong>, then open Phindu from your home
                  screen.
                </span>
              </li>
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              {canUseInstallButton
                ? "Tap Install below, or use your browser menu if you prefer."
                : "If no Install button appears yet, wait a moment or use your browser’s menu (⋮ → Install app / Add to Home screen)."}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {canUseInstallButton && (
              <Button
                variant="hero"
                className="w-full"
                onClick={handleInstallClick}
                disabled={installBusy}
              >
                <Download size={18} className="mr-2" />
                {installBusy ? "Opening installer…" : "Install app"}
              </Button>
            )}
            <Button variant={canUseInstallButton ? "outline" : "hero"} className="w-full" asChild>
              <a href="/">Back to home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
