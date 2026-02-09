import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminEmailLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("id, recipient, subject, status, type, message, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; recipient: string; subject: string | null; status: string; type: string; message: string | null; created_at: string }[];
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail size={24} /> Email Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Log of email send attempts. Errors are shown when delivery fails.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent emails</CardTitle>
            <CardDescription>Timestamp, recipient, subject, status, and error (if any)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No email log entries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{row.recipient}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.subject ?? "—"}</TableCell>
                      <TableCell>
                        {row.status === "sent" ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <CheckCircle size={12} className="mr-1" /> Sent
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                            <XCircle size={12} className="mr-1" /> Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-destructive text-sm">
                        {row.message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
