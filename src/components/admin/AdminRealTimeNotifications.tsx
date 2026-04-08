import { useEffect, useState, useRef, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Bell, CheckCircle, AlertTriangle, Info, FileText, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  };
}

const AdminRealTimeNotifications = forwardRef<HTMLDivElement>((_, ref) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio("/notification-sound.mp3");
    audioRef.current.volume = 0.5;

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Audio play failed:", e));
          }

          // Add notification to list
          setNotifications(prev => [newNotification, ...prev].slice(0, 5));

          // Auto-remove after 15 seconds for contract signed, 10 seconds for others
          const timeout = newNotification.event_type === 'contract_signed' ? 15000 : 10000;
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
          }, timeout);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string, eventType?: string) => {
    if (eventType === 'contract_signed') {
      return <FileText className="h-5 w-5 text-success" />;
    }
    switch (type) {
      case 'email':
        return <FileText className="h-5 w-5 text-info" />;
      case 'sms':
        return <Bell className="h-5 w-5 text-success" />;
      case 'whatsapp':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'admin_notification':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getTypeLabel = (type: string, eventType?: string) => {
    if (eventType === 'contract_signed') {
      return '📝 Contract Signed';
    }
    switch (type) {
      case 'email': return 'Email Sent';
      case 'sms': return 'SMS Sent';
      case 'whatsapp': return 'WhatsApp Sent';
      case 'admin_notification': return 'Admin Alert';
      default: return 'Notification';
    }
  };

  const handleViewContract = async (notification: Notification) => {
    // If we have a signed contract URL, open it
    if (notification.provider_response?.signedContractUrl) {
      window.open(notification.provider_response.signedContractUrl, '_blank');
      return;
    }
    
    // Otherwise, generate a new signed URL from the signature path
    if (notification.provider_response?.signatureUrl) {
      try {
        const { data } = await supabase.storage
          .from('loan-documents')
          .createSignedUrl(notification.provider_response.signatureUrl, 3600);
        
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
        }
      } catch (error) {
        console.error('Failed to get signed URL:', error);
      }
    }
  };

  const handleViewLoan = (loanId?: string) => {
    if (loanId) {
      // Navigate to the loans page - the modal will be opened from there
      window.location.href = `/admin/loans?highlight=${loanId}`;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div ref={ref} className="fixed top-4 right-4 z-[100] space-y-3 max-w-md">
      {notifications.map((notification) => {
        const isContractSigned = notification.event_type === 'contract_signed';
        const hasSignature = !!notification.provider_response?.signatureUrl;
        
        return (
          <div
            key={notification.id}
            className={cn(
              "relative overflow-hidden rounded-lg border shadow-2xl",
              "bg-gradient-to-r from-card via-card to-card/95",
              isContractSigned ? "border-success/50" : "border-primary/30",
              "backdrop-blur-sm",
              "animate-in slide-in-from-right-full duration-300"
            )}
          >
            {/* Glossy top gradient */}
            <div className={cn(
              "absolute inset-x-0 top-0 h-1",
              isContractSigned 
                ? "bg-gradient-to-r from-success via-success/80 to-success"
                : "bg-gradient-to-r from-[#6B1A3A] via-[#9B2D5A] to-[#6B1A3A]"
            )} />
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  "flex-shrink-0 rounded-full p-2",
                  isContractSigned ? "bg-success/20" : "bg-primary/10"
                )}>
                  {getIcon(notification.type, notification.event_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      isContractSigned ? "text-success" : "text-primary"
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
                  {notification.provider_response?.borrowerName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notification.provider_response.borrowerName}
                      {notification.provider_response.borrowerPhone && 
                        ` • ${notification.provider_response.borrowerPhone}`
                      }
                    </p>
                  )}
                  {!notification.provider_response?.borrowerName && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      To: {notification.recipient}
                    </p>
                  )}
                  
                  {/* Action buttons for contract signed */}
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
                      {notification.provider_response?.loanId && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => handleViewLoan(notification.provider_response?.loanId)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Loan
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>

            {/* Progress bar for auto-dismiss */}
            <div className="h-1 bg-muted overflow-hidden">
              <div 
                className={cn(
                  "h-full animate-shrink-width",
                  isContractSigned 
                    ? "bg-gradient-to-r from-success to-success/80"
                    : "bg-gradient-to-r from-[#6B1A3A] to-[#9B2D5A]"
                )}
                style={{ animationDuration: isContractSigned ? '15s' : '10s' }}
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
