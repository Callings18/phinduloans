import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@phinduloans/shared/components/ui/dropdown-menu";
import {
    Bell,
    Check,
    X,
    Info,
    AlertTriangle,
    CheckCircle,
    XCircle,
    CreditCard,
    Wallet,
    Loader2,
    Trash2,
    BellRing,
} from "lucide-react";
import { cn } from "@phinduloans/shared/lib/utils";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { pushNotificationManager } from "@phinduloans/shared/utils/pushNotifications";
import { useToast } from "@phinduloans/shared/hooks/use-toast";

interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error" | "loan" | "payment";
    is_read: boolean;
    created_at: string;
    action_url?: string | null;
    metadata?: any;
}

const getNotificationIcon = (type: Notification["type"]) => {
    const icons = {
        info: <Info size={16} className="text-blue-400" />,
        success: <CheckCircle size={16} className="text-green-400" />,
        warning: <AlertTriangle size={16} className="text-yellow-400" />,
        error: <XCircle size={16} className="text-red-400" />,
        loan: <CreditCard size={16} className="text-purple-400" />,
        payment: <Wallet size={16} className="text-emerald-400" />,
    };
    return icons[type] || icons.info;
};

const NotificationCenter: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [showPushPrompt, setShowPushPrompt] = useState(false);

    // Fetch notifications from in-app inbox
    const { data: notifications = [], isLoading, isError } = useQuery({
        queryKey: ["notifications", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from("notification_inbox")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching notifications:", error);
                return [];
            }
            return (data ?? []) as unknown as Notification[];
        },
        enabled: !!user?.id,
        refetchInterval: 60000,
    });

    // Check push notification permission status
    useEffect(() => {
        const checkPushStatus = async () => {
            if (!pushNotificationManager.isSubscriptionReady()) {
                setPushEnabled(false);
                setShowPushPrompt(false);
                return;
            }
            const permission = pushNotificationManager.getPermissionStatus();
            setPushEnabled(permission === 'granted');
            
            // Show prompt if not granted and not dismissed
            if (permission === 'default' && !localStorage.getItem('push-prompt-dismissed')) {
                setTimeout(() => setShowPushPrompt(true), 5000); // Show after 5 seconds
            }
        };
        checkPushStatus();
    }, [user?.id]);

    // Subscribe to realtime inbox
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`inbox-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notification_inbox",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });

                    const newNotification = payload.new as Notification;
                    toast({
                        title: newNotification.title,
                        description: newNotification.message,
                        duration: 5000,
                    });

                    if (pushEnabled) {
                        pushNotificationManager.showNotification({
                            title: newNotification.title,
                            body: newNotification.message,
                            tag: newNotification.id,
                            data: newNotification,
                        });
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "notification_inbox",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, queryClient, toast, pushEnabled]);

    // Enable push notifications
    const handleEnablePush = async () => {
        if (!pushNotificationManager.isSubscriptionReady()) {
            toast({
                title: "Push Notifications Unavailable",
                description: "Push subscriptions are temporarily disabled while backend sync is finalized.",
            });
            return;
        }

        const permission = await pushNotificationManager.requestPermission();
        if (permission === 'granted') {
            await pushNotificationManager.init();
            if (user?.id) {
                const sub = await pushNotificationManager.subscribe(user.id);
                if (!sub) {
                    toast({
                        title: "Push setup incomplete",
                        description: "Could not save this device for push. Check VITE_VAPID_PUBLIC_KEY and database migration.",
                        variant: "destructive",
                    });
                    return;
                }
            }
            setPushEnabled(true);
            setShowPushPrompt(false);
            toast({
                title: "Push Notifications Enabled",
                description: "You'll now receive real-time notifications",
            });
        } else {
            toast({
                title: "Permission Denied",
                description: "You can enable notifications in your browser settings",
                variant: "destructive",
            });
        }
    };

    const handleDismissPushPrompt = () => {
        setShowPushPrompt(false);
        localStorage.setItem('push-prompt-dismissed', 'true');
        // Auto-show again after 7 days
        setTimeout(() => {
            localStorage.removeItem('push-prompt-dismissed');
        }, 7 * 24 * 60 * 60 * 1000);
    };

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            const { error } = await supabase
                .from("notification_inbox")
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq("id", notificationId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
        },
    });

    // Mark all as read
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) return;
            const { error } = await supabase
                .from("notification_inbox")
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq("user_id", user.id)
                .eq("is_read", false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
        },
    });

    // Delete notification
    const deleteNotificationMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            const { error } = await supabase
                .from("notification_inbox")
                .delete()
                .eq("id", notificationId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
        },
    });

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const handleNotificationOpen = (notification: Notification) => {
        if (!notification.is_read) {
            markAsReadMutation.mutate(notification.id);
        }
        if (notification.action_url) {
            setIsOpen(false);
            const url = notification.action_url;
            if (url.startsWith("http://") || url.startsWith("https://")) {
                window.location.assign(url);
            } else {
                navigate(url);
            }
        }
    };

    if (!user) return null;

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] gradient-primary border-0 animate-pulse"
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-80 max-h-96 overflow-hidden glass border-border/50"
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => markAllAsReadMutation.mutate()}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                {/* Push Notification Prompt */}
                {showPushPrompt && !pushEnabled && (
                    <div className="px-3 py-3 bg-primary/5 border-b border-border/50">
                        <div className="flex items-start gap-2">
                            <BellRing className="text-primary mt-0.5" size={16} />
                            <div className="flex-1">
                                <p className="text-xs font-medium mb-1">Enable Push Notifications</p>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Get instant updates about your loans, payments, and applications
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 text-xs"
                                        onClick={handleEnablePush}
                                    >
                                        Enable
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={handleDismissPushPrompt}
                                    >
                                        Not Now
                                    </Button>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleDismissPushPrompt}
                            >
                                <X size={14} />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto max-h-72">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center py-8 text-destructive px-4 text-center">
                            <AlertTriangle size={28} className="mb-2 opacity-80" />
                            <p className="text-sm font-medium">Could not load notifications</p>
                            <p className="text-xs text-muted-foreground mt-1">Pull to refresh or try again shortly.</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Bell size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                role={notification.action_url ? "button" : undefined}
                                tabIndex={notification.action_url ? 0 : undefined}
                                onClick={() => notification.action_url && handleNotificationOpen(notification)}
                                onKeyDown={(e) => {
                                    if (notification.action_url && (e.key === "Enter" || e.key === " ")) {
                                        e.preventDefault();
                                        handleNotificationOpen(notification);
                                    }
                                }}
                                className={cn(
                                    "flex gap-3 px-3 py-3 border-b border-border/30 hover:bg-secondary/50 transition-colors",
                                    !notification.is_read && "bg-primary/5",
                                    notification.action_url && "cursor-pointer"
                                )}
                            >
                                <div className="shrink-0 mt-0.5">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    {!notification.is_read && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsReadMutation.mutate(notification.id);
                                            }}
                                        >
                                            <Check size={12} />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotificationMutation.mutate(notification.id);
                                        }}
                                    >
                                        <Trash2 size={12} />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default NotificationCenter;
