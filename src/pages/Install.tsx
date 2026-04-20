import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, ShieldCheck, Zap, WifiOff } from "lucide-react";
import { APK_URL, downloadApk, isAndroidDevice, isIOSDevice } from "@/utils/appDownload";
import { Link } from "react-router-dom";

const Install = () => {
  const onAndroid = isAndroidDevice();
  const onIOS = isIOSDevice();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex w-20 h-20 rounded-3xl bg-primary items-center justify-center shadow-2xl mb-5">
            <img src="/icons/icon-512.png" alt="Phindu Credit" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Get the Phindu Loans App
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Apply faster, get push reminders and access your loan anywhere — even offline.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Android APK */}
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                  <Smartphone className="text-primary-foreground" size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Android</h2>
                  <p className="text-sm text-muted-foreground">Direct APK download</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Download and install the official Phindu Credit app directly on your Android phone.
              </p>
              <Button
                size="lg"
                onClick={downloadApk}
                className="w-full"
              >
                <Download size={18} className="mr-2" />
                Download APK ({onAndroid ? "Recommended" : "5.7 MB"})
              </Button>
              <a
                href={APK_URL}
                download
                className="block text-xs text-center text-muted-foreground hover:text-primary transition-colors"
              >
                Or right-click here to save the file
              </a>
              <div className="pt-3 border-t border-border/50 space-y-2">
                <p className="text-xs font-semibold text-foreground">After download:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open the downloaded <strong>PhinduCredit.apk</strong> file</li>
                  <li>Allow "Install from unknown sources" if asked</li>
                  <li>Tap <strong>Install</strong> and open the app</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* iOS / Other */}
          <Card className="bg-card">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-background" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3-.79.83-2.07 1.47-3.12 1.39-.13-1.1.41-2.24 1.13-3 .82-.86 2.21-1.5 3.2-1.39zM20.5 17.34c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.13 3.51-1.55.02-1.95-1.01-4.06-1-2.11.01-2.55 1.02-4.1 1-1.74-.02-3.07-1.77-4.06-3.33C.16 17.16-.13 11.96 1.85 9.21c1.41-1.96 3.65-3.11 5.75-3.11 2.13 0 3.47 1.17 5.23 1.17 1.71 0 2.75-1.17 5.21-1.17 1.86 0 3.83 1.01 5.23 2.76-4.6 2.52-3.85 9.09 -2.27 8.48z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">iPhone / iPad</h2>
                  <p className="text-sm text-muted-foreground">Add to Home Screen</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Apple does not allow APK installs. Install Phindu as a home-screen app from Safari instead.
              </p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside bg-muted/50 rounded-lg p-4">
                <li>Open <strong>phinducredit.co.zm</strong> in <strong>Safari</strong></li>
                <li>Tap the <strong>Share</strong> button at the bottom</li>
                <li>Choose <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> — the app icon appears on your home screen</li>
              </ol>
              {onIOS ? null : (
                <p className="text-xs text-muted-foreground">
                  Open this page on your iPhone in Safari to follow these steps.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Store badges (display only) */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Coming soon to
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 bg-foreground text-background rounded-xl px-5 py-3 opacity-80">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3-.79.83-2.07 1.47-3.12 1.39-.13-1.1.41-2.24 1.13-3 .82-.86 2.21-1.5 3.2-1.39zM20.5 17.34c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.13 3.51-1.55.02-1.95-1.01-4.06-1-2.11.01-2.55 1.02-4.1 1-1.74-.02-3.07-1.77-4.06-3.33-2.78-4.32-3.07-9.52-1.09-12.27 1.41-1.96 3.65-3.11 5.75-3.11 2.13 0 3.47 1.17 5.23 1.17 1.71 0 2.75-1.17 5.21-1.17 1.86 0 3.83 1.01 5.23 2.76-4.6 2.52-3.85 9.09-2.27 8.48z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] leading-none opacity-80">Coming soon on the</p>
                <p className="text-base font-semibold leading-tight">App Store</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-foreground text-background rounded-xl px-5 py-3 opacity-80">
              <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
                <path fill="#34A853" d="M3 20.5V3.5c0-.6.3-1 .8-1.3l11.7 9.8L3.8 21.8c-.5-.3-.8-.7-.8-1.3z" />
                <path fill="#FBBC04" d="M17.6 14.4l-2.6-2.4 2.6-2.4 3.5 2c.7.4.7 1.4 0 1.8l-3.5 2z" />
                <path fill="#EA4335" d="M15 12l-11.2 9.8c.4.2.9.2 1.3-.1L17.6 14.4 15 12z" />
                <path fill="#4285F4" d="M15 12l2.6-2.4L5.1 2.3c-.4-.3-.9-.3-1.3-.1L15 12z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] leading-none opacity-80">Coming soon on</p>
                <p className="text-base font-semibold leading-tight">Google Play</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Zap, label: "Lightning fast", desc: "Optimized native performance" },
            { icon: WifiOff, label: "Works offline", desc: "Access your loan anytime" },
            { icon: ShieldCheck, label: "Bank-level security", desc: "Encrypted end-to-end" },
          ].map((f) => (
            <Card key={f.label} className="bg-card/60">
              <CardContent className="p-4 text-center">
                <f.icon className="text-primary mx-auto mb-2" size={22} />
                <p className="font-semibold text-foreground text-sm">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Install;
