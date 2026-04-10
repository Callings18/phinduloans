import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Download, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

export const PWAInstallPrompt = () => {
  const { deferredPrompt, promptInstall } = usePwaInstallPrompt();
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowPrompt(false);
      return;
    }
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (deferredPrompt && !dismissed) {
      setShowPrompt(true);
    }
    if (!deferredPrompt) {
      setShowPrompt(false);
    }
  }, [deferredPrompt]);

  const handleInstall = async () => {
    const choice = await promptInstall();
    if (choice?.outcome === "accepted") {
      toast({
        title: "App Installing",
        description: "Phindu Loans is being added to your home screen",
      });
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
    setTimeout(() => {
      localStorage.removeItem("pwa-install-dismissed");
    }, 7 * 24 * 60 * 60 * 1000);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md animate-slide-up">
      <Card className="glass border-primary/50 shadow-2xl">
        <CardContent className="p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
              <Smartphone className="text-white" size={24} />
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Install Phindu Loans App</h3>
                <p className="text-sm text-muted-foreground">
                  Install our app for quick access to loans, faster applications, and offline support.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="hero" size="sm" onClick={handleInstall} className="flex-1">
                  <Download size={16} className="mr-2" />
                  Install App
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss}>
                  Not Now
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                ✓ Works offline • ✓ Faster load times • ✓ Push notifications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
