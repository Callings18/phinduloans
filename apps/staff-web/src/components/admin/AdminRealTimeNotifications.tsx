import { useEffect, useState, useRef, forwardRef } from "react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { X, Bell, CheckCircle, AlertTriangle, Info, FileText, Download, ExternalLink, ClipboardList } from "lucide-react";
import { cn } from "@phinduloans/shared/lib/utils";
import { Button } from "@phinduloans/shared/components/ui/button";
import { getSignedUrl } from "@phinduloans/shared/utils/storageHelpers";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  recipient: string;
  created_at: string;
  status: string;
  event_type?: string;
  provider_response?: {
    loanId?: string;
    borrowerName?: string;
    borrowerPhone?: string;
    signatureUrl?: string;
    signedContractUrl?: string;
    loanAmount?: number;
    source?: string;
  };
}

type LoanApplicationRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  loan_amount: number | null;
  source: string | null;
  created_at: string;
};

function loanApplicationToNotification(app: LoanApplicationRow): Notification {
  const amount = app.loan_amount != null ? `K${Number(app.loan_amount).toLocaleString()}` : "—";
  const sourceLabel = app.source === "dashboard" ? "Borrower portal" : (app.source || "Staff");
  return {
    id: `loan-app-${app.id}`,
    type: "admin_notification",
    title: "New loan application",
    message: `${app.full_name || "Borrower"} applied for ${amount} (${sourceLabel})`,
    recipient: "admin",
    created_at: app.created_at || new Date().toISOString(),
    status: "sent",
    event_type: "application_submitted",
    provider_response: {
      loanId: app.id,
      borrowerName: app.full_name || undefined,
      borrowerPhone: app.phone || undefined,
      loanAmount: app.loan_amount ?? undefined,
      source: app.source || undefined,
    },
  };
}

const AdminRealTimeNotifications = forwardRef<HTMLDivElement>((_, ref) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const pushNotification = (notification: Notification) => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => undefined);
    }
    setNotifications((prev) => [notification, ...prev].slice(0, 5));
    const timeout = notification.event_type === "contract_signed" ? 15000 : 12000;
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, timeout);
  };

  useEffect(() => {
    audioRef.current = new Audio("/notification-sound.mp3");
    if (audioRef.current) audioRef.current.volume = 0.5;

    const logsChannel = supabase
      .channel("admin-notifications-logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_logs",
        },
        (payload) => {
          pushNotification(payload.new as Notification);
        },
      )
      .subscribe();

    const applicationsChannel = supabase
      .channel("admin-notifications-applications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "loan_applications",
        },
        (payload) => {
          pushNotification(loanApplicationToNotification(payload.new as LoanApplicationRow));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getIcon = (type: string, eventType?: string) => {
    if (eventType === "application_submitted") {
      return <ClipboardList className="h-5 w-5 text-primary" />;
    }
    if (eventType === "contract_signed") {
      return <FileText className="h-5 w-5 text-success" />;
    }
    switch (type) {
      case "email":
        return <FileText className="h-5 w-5 text-info" />;
      case "sms":
        return <Bell className="h-5 w-5 text-success" />;
      case "whatsapp":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "admin_notification":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getTypeLabel = (type: string, eventType?: string) => {
    if (eventType === "application_submitted") {
      return "New Application";
    }
    if (eventType === "contract_signed") {
      return "Contract Signed";
    }
    switch (type) {
      case "email": return "Email Sent";
      case "sms": return "SMS Sent";
      case "whatsapp": return "WhatsApp Sent";
      case "admin_notification": return "Admin Alert";
      default: return "Notification";
    }
  };

  const handleViewContract = async (notification: Notification) => {
    if (notification.provider_response?.signedContractUrl) {
      const url = await getSignedUrl(notification.provider_response.signedContractUrl, "loan-documents");
      if (url) window.open(url, "_blank");
      return;
    }

    if (notification.provider_response?.signatureUrl) {
      try {
        const url = await getSignedUrl(notification.provider_response.signatureUrl, "loan-documents");
        if (url) window.open(url, "_blank");
      } catch (error) {
        console.error("Failed to download document:", error);
      }
    }
  };

  const handleViewLoan = (loanId?: string) => {
    if (loanId) {
      window.location.href = `/admin/loans?highlight=${loanId}`;
    }
  };

  const handleViewApplication = (loanId?: string) => {
    if (loanId) {
      window.location.href = `/admin/applications?id=${loanId}`;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div ref={ref} className="fixed top-4 right-4 z-[100] space-y-3 max-w-md">
      {notifications.map((notification) => {
        const isContractSigned = notification.event_type === "contract_signed";
        const isNewApplication = notification.event_type === "application_submitted";
        const hasSignature = !!notification.provider_response?.signatureUrl;
        const loanId = notification.provider_response?.loanId;

        return (
          <div
            key={notification.id}
            className={cn(
              "relative overflow-hidden rounded-lg border shadow-2xl",
              "bg-gradient-to-r from-card via-card to-card/95",
              isContractSigned ? "border-success/50" : isNewApplication ? "border-primary/50" : "border-primary/30",
              "backdrop-blur-sm",
              "animate-in slide-in-from-right-full duration-300",
            )}
          >
            <div className={cn(
              "absolute inset-x-0 top-0 h-1",
              isContractSigned
                ? "bg-gradient-to-r from-success via-success/80 to-success"
                : isNewApplication
                  ? "bg-gradient-to-r from-[#6B1A3A] via-[#9B2D5A] to-[#6B1A3A]"
                  : "bg-gradient-to-r from-[#6B1A3A] via-[#9B2D5A] to-[#6B1A3A]",
            )} />

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 rounded-full p-2",
                  isContractSigned ? "bg-success/20" : "bg-primary/10",
                )}>
                  {getIcon(notification.type, notification.event_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      isContractSigned ? "text-success" : "text-primary",
                    )}>
                      {getTypeLabel(notification.type, notification.event_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {notification.title}
                  </p>
                  {(notification.message || notification.provider_response?.borrowerName) && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.provider_response?.borrowerName
                        ? notification.message
                        : notification.message || `To: ${notification.recipient}`}
                    </p>
                  )}

                  {isContractSigned && (
                    <div className="flex gap-2 mt-3">
                      {hasSignature && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleViewContract(notification)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          View Signature
                        </Button>
                      )}
                      {loanId && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => handleViewLoan(loanId)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Loan
                        </Button>
                      )}
                    </div>
                  )}

                  {isNewApplication && loanId && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => handleViewApplication(loanId)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Review Application
                      </Button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>

            <div className="h-1 bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full animate-shrink-width",
                  isContractSigned
                    ? "bg-gradient-to-r from-success to-success/80"
                    : "bg-gradient-to-r from-[#6B1A3A] to-[#9B2D5A]",
                )}
                style={{ animationDuration: isContractSigned ? "15s" : "12s" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

AdminRealTimeNotifications.displayName = "AdminRealTimeNotifications";

export default AdminRealTimeNotifications;
