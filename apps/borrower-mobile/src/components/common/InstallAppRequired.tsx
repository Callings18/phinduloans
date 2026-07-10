import { Link } from "react-router-dom";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Smartphone, Download } from "lucide-react";
import { downloadApk, isAndroidDevice } from "@phinduloans/shared/utils/appDownload";

/**
 * Legacy hard-wall UI — no longer mounted on dashboard/apply (web-first).
 * Kept for optional deep-links; always offers Continue on web + APK download.
 */
export function InstallAppRequired() {
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
            <h1 className="text-xl font-semibold text-foreground">Use Phindu on the web</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can log in, apply for loans, and manage repayments in your browser. Installing the app is optional.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="hero" className="w-full" asChild>
              <Link to="/dashboard">Continue on web</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => downloadApk()}
            >
              <Download size={18} className="mr-2" />
              {isAndroidDevice() ? "Download App (APK)" : "Download APK"}
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/install">More install options</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
