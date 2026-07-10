import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Download, Smartphone, Share, PlusSquare, ArrowLeft } from "lucide-react";
import { APK_URL, downloadApk, isAndroidDevice, isIOSDevice } from "@phinduloans/shared/utils/appDownload";
import { Link } from "react-router-dom";
import { usePwaInstallPrompt } from "@phinduloans/shared/hooks/usePwaInstallPrompt";
import { isStandaloneDisplayMode } from "@phinduloans/shared/utils/pwaDisplayMode";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

/**
 * Borrower-only install / download page (APK + optional PWA).
 * Web app remains fully usable without installing.
 */
const Install = () => {
  const onAndroid = isAndroidDevice();
  const onIOS = isIOSDevice();
  const { deferredPrompt, promptInstall } = usePwaInstallPrompt();
  const { toast } = useToast();
  const standalone = isStandaloneDisplayMode();

  const handlePwaInstall = async () => {
    if (!deferredPrompt) {
      toast({
        title: "Use your browser menu",
        description: "Open the browser menu (⋮) and tap Install app / Add to Home Screen.",
      });
      return;
    }
    const choice = await promptInstall();
    if (choice?.outcome === "accepted") {
      toast({
        title: "App installing",
        description: "Open Phindu from your home screen when it appears.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link to="/dashboard">
            <ArrowLeft size={16} className="mr-1" />
            Back to app
          </Link>
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/15 items-center justify-center mb-4">
            <Smartphone className="text-primary" size={28} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Install Phindu Loans</h1>
          <p className="text-muted-foreground">
            Optional — you can keep using the full web app in your browser. Install for faster access and notifications.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="border-primary/30">
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-foreground">Android APK</h2>
              <p className="text-sm text-muted-foreground">
                Download the app file and install it on your phone
                {onAndroid ? " (recommended on Android)." : "."}
              </p>
              <Button className="w-full" onClick={downloadApk}>
                <Download size={16} className="mr-2" />
                Download APK
              </Button>
              <a
                href={APK_URL}
                download
                className="block text-xs text-center text-muted-foreground hover:text-primary"
              >
                Or save PhinduCredit.apk directly
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-foreground">
                {onIOS ? "iPhone / iPad" : "Add to Home Screen"}
              </h2>
              {onIOS ? (
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li className="flex gap-2 items-start">
                    <Share className="shrink-0 mt-0.5 text-primary" size={14} />
                    <span>Tap Share in Safari</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <PlusSquare className="shrink-0 mt-0.5 text-primary" size={14} />
                    <span>Choose Add to Home Screen</span>
                  </li>
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {standalone
                    ? "You are already using the installed app."
                    : "Install as a web app for offline-friendly loading and shortcuts."}
                </p>
              )}
              {!standalone && !onIOS && (
                <Button variant="outline" className="w-full" onClick={handlePwaInstall}>
                  <Download size={16} className="mr-2" />
                  Install web app
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button variant="hero" asChild>
            <Link to="/dashboard">Continue on web</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
