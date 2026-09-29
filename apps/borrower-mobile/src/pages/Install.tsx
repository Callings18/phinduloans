import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Download, Smartphone, Share, PlusSquare, ArrowLeft, Globe } from "lucide-react";
import {
  APK_URL,
  PLAY_STORE_URL,
  downloadApk,
  isAndroidDevice,
  isIOSDevice,
} from "@phinduloans/shared/utils/appDownload";
import { Link } from "react-router-dom";
import { usePwaInstallPrompt } from "@phinduloans/shared/hooks/usePwaInstallPrompt";
import { isStandaloneDisplayMode } from "@phinduloans/shared/utils/pwaDisplayMode";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

/**
 * Optional install page only — never linked from /auth with APK downloads.
 * Web sign-in at /auth is the primary path for all Chrome users.
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Optional app shortcuts</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Phindu Credit Solutions — official borrower portal at{" "}
            <strong className="text-foreground">app.phindu.com</strong>. You do not need to install
            anything to apply or repay; use your browser anytime.
          </p>
        </div>

        <Card className="border-primary/30 mb-6">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Globe size={18} className="text-primary" />
              Recommended: use the web app
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your phone number at{" "}
              <Link to="/auth" className="text-primary underline">
                app.phindu.com/auth
              </Link>
              . Same account on any device.
            </p>
            <Button variant="hero" className="w-full" asChild>
              <Link to="/dashboard">Continue on web</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-foreground">
                {onIOS ? "iPhone / iPad (Safari)" : "Add to Home Screen"}
              </h2>
              {onIOS ? (
                <>
                  <p className="text-xs text-muted-foreground">Native App Store listing — coming soon.</p>
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {standalone
                    ? "You are already using the installed web app."
                    : "Install as a shortcut — works like an app icon without downloading files."}
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

          <Card className="md:order-last">
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold text-foreground">Android package (optional)</h2>
              <p className="text-sm text-muted-foreground">
                Only download from this page if you trust Phindu Credit Solutions. Package:{" "}
                <code className="text-xs">com.phindu.loans.borrower</code>.
                {onAndroid ? " Prefer Google Play when available." : ""}
              </p>
              {PLAY_STORE_URL ? (
                <Button className="w-full" asChild>
                  <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                    <Download size={16} className="mr-2" />
                    Get it on Google Play
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={downloadApk}>
                  <Download size={16} className="mr-2" />
                  Download official APK
                </Button>
              )}
              {!PLAY_STORE_URL && (
                <a
                  href={APK_URL}
                  download="PhinduCredit.apk"
                  rel="noopener noreferrer nofollow"
                  className="block text-xs text-center text-muted-foreground hover:text-primary"
                >
                  Direct file: PhinduCredit.apk
                </a>
              )}
              <p className="text-[11px] text-muted-foreground leading-snug">
                Questions?{" "}
                <a href="mailto:info@phinducredit.co.zm" className="text-primary hover:underline">
                  info@phinducredit.co.zm
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Install;
