import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  History,
  Search,
  User,
  FileEdit,
  Trash2,
  PlusCircle,
  Eye,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Activity,
  CreditCard,
  DollarSign,
  UserCheck,
  Settings,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 20;

const actionConfig: Record<string, { label: string; color: string; icon: any }> = {
  INSERT: { label: "Created", color: "bg-success/20 text-success border-success/30", icon: PlusCircle },
  UPDATE: { label: "Updated", color: "bg-info/20 text-info border-info/30", icon: FileEdit },
  DELETE: { label: "Deleted", color: "bg-destructive/20 text-destructive border-destructive/30", icon: Trash2 },
  REPAYMENT_CREATED: { label: "Repayment", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: DollarSign },
  LOGIN: { label: "Login", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: UserCheck },
  LOGOUT: { label: "Logout", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: UserCheck },
};

const entityConfig: Record<string, { label: string; icon: any }> = {
  loan_application: { label: "Loan Application", icon: CreditCard },
  repayment: { label: "Repayment", icon: DollarSign },
  user: { label: "User", icon: User },
  profile: { label: "Profile", icon: User },
  settings: { label: "Settings", icon: Settings },
};

const AdminAuditLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", page, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    },
  });

  const { data: userProfiles } = useQuery({
    queryKey: ["audit-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const profile = userProfiles?.find(p => p.id === userId);
    return profile?.full_name || profile?.email || userId.substring(0, 8);
  };

  const filteredLogs = logs?.data?.filter((log) => {
    const matchesSearch =
      log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserName(log.user_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil((logs?.count || 0) / ITEMS_PER_PAGE);

  const viewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  const renderJsonDiff = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return <p className="text-muted-foreground">No data changes recorded</p>;

    const allKeys = new Set([
      ...Object.keys(oldVal || {}),
      ...Object.keys(newVal || {}),
    ]);

    return (
      <div className="space-y-2">
        {Array.from(allKeys).map((key) => {
          const oldValue = oldVal?.[key];
          const newValue = newVal?.[key];
          const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);

          if (!changed && oldVal && newVal) return null;

          return (
            <div key={key} className="text-sm border-b border-border/30 pb-2">
              <span className="font-medium text-foreground">{key}:</span>
              {oldVal && (
                <div className="ml-4">
                  <span className="text-destructive bg-destructive/10 px-1 rounded">
                    - {JSON.stringify(oldValue)}
                  </span>
                </div>
              )}
              {newVal && (
                <div className="ml-4">
                  <span className="text-success bg-success/10 px-1 rounded">
                    + {JSON.stringify(newValue)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <History className="text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all system activities and changes
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Activity className="text-primary-foreground" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{logs?.count || 0}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <PlusCircle className="text-success" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {logs?.data?.filter(l => l.action === 'INSERT').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Creates</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
                <FileEdit className="text-info" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {logs?.data?.filter(l => l.action === 'UPDATE').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Updates</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <Trash2 className="text-destructive" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {logs?.data?.filter(l => l.action === 'DELETE').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Deletes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by user, entity ID, or action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                  <SelectItem value="REPAYMENT_CREATED">Repayment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="loan_application">Loan Applications</SelectItem>
                  <SelectItem value="repayment">Repayments</SelectItem>
                  <SelectItem value="profile">Profiles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>
              Showing {filteredLogs?.length || 0} of {logs?.count || 0} events
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="py-12 text-center">
                <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No audit logs found</h3>
                <p className="text-muted-foreground">
                  System activity will appear here as it occurs
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => {
                      const actionCfg = actionConfig[log.action] || {
                        label: log.action,
                        color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
                        icon: Activity,
                      };
                      const ActionIcon = actionCfg.icon;
                      const entityCfg = entityConfig[log.entity_type] || {
                        label: log.entity_type,
                        icon: FileEdit,
                      };
                      const EntityIcon = entityCfg.icon;

                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-foreground">
                                {format(new Date(log.created_at), "MMM dd, yyyy")}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {format(new Date(log.created_at), "HH:mm:ss")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <User className="text-primary" size={14} />
                              </div>
                              <span className="text-sm text-foreground">
                                {getUserName(log.user_id)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={actionCfg.color}>
                              <ActionIcon size={12} className="mr-1" />
                              {actionCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <EntityIcon size={14} className="text-muted-foreground" />
                              {entityCfg.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-secondary px-2 py-1 rounded">
                              {log.entity_id.substring(0, 8)}...
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetails(log)}
                            >
                              <Eye size={14} className="mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages || 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="text-primary" />
                Audit Log Details
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Timestamp</p>
                      <p className="font-medium text-foreground">
                        {format(new Date(selectedLog.created_at), "PPpp")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">User</p>
                      <p className="font-medium text-foreground">
                        {getUserName(selectedLog.user_id)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Action</p>
                      <Badge variant="outline" className={actionConfig[selectedLog.action]?.color || ""}>
                        {actionConfig[selectedLog.action]?.label || selectedLog.action}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entity Type</p>
                      <p className="font-medium text-foreground capitalize">
                        {selectedLog.entity_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Entity ID</p>
                      <code className="text-sm bg-secondary px-2 py-1 rounded">
                        {selectedLog.entity_id}
                      </code>
                    </div>
                    {selectedLog.ip_address && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">IP Address</p>
                        <code className="text-sm bg-secondary px-2 py-1 rounded">
                          {selectedLog.ip_address}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Changes */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Changes</h4>
                    <div className="bg-secondary/30 rounded-lg p-4">
                      {renderJsonDiff(selectedLog.old_values, selectedLog.new_values)}
                    </div>
                  </div>

                  {/* Additional Details */}
                  {selectedLog.details && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Additional Details</h4>
                      <pre className="bg-secondary/30 rounded-lg p-4 text-sm overflow-x-auto">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogs;
