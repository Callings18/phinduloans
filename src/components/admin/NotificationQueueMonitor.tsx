import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function NotificationQueueMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch queue statistics using direct queries instead of RPC
  const { data: queueStats, isLoading: statsLoading } = useQuery({
    queryKey: ['notification-queue-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get pending count
      const { count: pendingCount } = await supabase
        .from('notification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      // Get failed count
      const { count: failedCount } = await supabase
        .from('notification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      
      // Get sent today count
      const { count: sentToday } = await supabase
        .from('notification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', today.toISOString());
      
      return {
        pending_count: pendingCount || 0,
        failed_count: failedCount || 0,
        sent_today: sentToday || 0,
        avg_retry_count: 0
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent pending notifications
  const { data: pendingNotifications, isLoading: pendingLoading } = useQuery({
    queryKey: ['notification-queue-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch recent failed notifications
  const { data: failedNotifications, isLoading: failedLoading } = useQuery({
    queryKey: ['notification-queue-failed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Manually trigger queue processing
  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-notification-queue', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Queue Processing Started",
        description: `Processing ${data?.results?.processed || 0} notifications`,
      });
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    },
    onError: (error: any) => {
      toast({
        title: "Queue Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (statsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const stats = queueStats || { pending_count: 0, failed_count: 0, sent_today: 0, avg_retry_count: 0 };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.pending_count || 0}</div>
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-destructive">{stats.failed_count || 0}</div>
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-success">{stats.sent_today || 0}</div>
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Retries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{Number(stats.avg_retry_count || 0).toFixed(1)}</div>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Queue</CardTitle>
              <CardDescription>Monitor and manage pending notifications</CardDescription>
            </div>
            <Button
              onClick={() => processQueueMutation.mutate()}
              disabled={processQueueMutation.isPending || (stats.pending_count || 0) === 0}
              size="sm"
            >
              {processQueueMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Queue Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pending Notifications */}
          {pendingLoading ? (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : pendingNotifications && pendingNotifications.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold mb-2">Pending Notifications ({pendingNotifications.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingNotifications.map((notif: any) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {notif.type}
                        </Badge>
                        <span className="text-sm font-medium">{notif.recipient}</span>
                        {notif.retry_count > 0 && (
                          <Badge variant="outline" className="text-xs text-yellow-600">
                            Retry {notif.retry_count}/3
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{notif.title || notif.message?.substring(0, 50)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notif.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p>No pending notifications</p>
            </div>
          )}

          {/* Failed Notifications */}
          {failedNotifications && failedNotifications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-destructive">
                Recent Failures ({failedNotifications.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {failedNotifications.map((notif: any) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {notif.type}
                        </Badge>
                        <span className="text-sm font-medium">{notif.recipient}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{notif.title || notif.message?.substring(0, 50)}</p>
                      {notif.error_message && (
                        <p className="text-xs text-destructive mt-1">{notif.error_message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notif.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      {(stats.pending_count || 0) > 10 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  High Queue Volume
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  There are {stats.pending_count} pending notifications. The queue processor runs automatically every 5 minutes, or you can process manually using the button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
