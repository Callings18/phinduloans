import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Bell, CheckCircle, AlertTriangle, Info, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  recipient: string;
  created_at: string;
  status: string;
}

const AdminRealTimeNotifications = () => {
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

          // Auto-remove after 10 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
          }, 10000);
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

  const getIcon = (type: string) => {
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email': return 'Email Sent';
      case 'sms': return 'SMS Sent';
      case 'whatsapp': return 'WhatsApp Sent';
      case 'admin_notification': return 'Admin Alert';
      default: return 'Notification';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "relative overflow-hidden rounded-lg border shadow-2xl",
            "bg-gradient-to-r from-card via-card to-card/95",
            "border-primary/30 backdrop-blur-sm",
            "animate-in slide-in-from-right-full duration-300"
          )}
        >
          {/* Glossy top gradient */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6B1A3A] via-[#9B2D5A] to-[#6B1A3A]" />
          
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
                {getIcon(notification.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {getTypeLabel(notification.type)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  To: {notification.recipient}
                </p>
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
              className="h-full bg-gradient-to-r from-[#6B1A3A] to-[#9B2D5A] animate-shrink-width"
              style={{ animationDuration: '10s' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminRealTimeNotifications;
