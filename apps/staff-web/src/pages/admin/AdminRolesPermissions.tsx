/**
 * RBAC matrix UI — expects tables from 20260209232412 migration:
 * roles(name), permissions(module, action), role_permissions(role_name, permission_id).
 */
import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { Loader2, Save, Shield, ShieldCheck, Info, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@phinduloans/shared/components/ui/tooltip";

interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string;
}

interface RolePermission {
  role_name: string;
  permission_id: string;
}

const MODULE_LABELS: Record<string, { label: string; description: string }> = {
  loans: { label: "Loans", description: "Loan applications, approvals, and lifecycle management" },
  borrowers: { label: "Borrowers", description: "Borrower profiles and management" },
  disbursement: { label: "Disbursements", description: "Fund disbursement processing" },
  repayments: { label: "Repayments", description: "Payment recording and tracking" },
  collections: { label: "Collections", description: "Overdue account recovery" },
  products: { label: "Loan Products", description: "Product configuration and terms" },
  reports: { label: "Reports", description: "Analytics and report generation" },
  expenses: { label: "Expenses", description: "Company expense management" },
  payroll: { label: "Payroll", description: "Payroll runs, payslips, and statutory calculations" },
  hr: { label: "Human resources", description: "Internal employees, salary structures, and HR records" },
  audit: { label: "Audit Logs", description: "System activity tracking" },
  settings: { label: "Settings", description: "System configuration" },
  staff: { label: "Staff", description: "Staff user management" },
  wallets: { label: "Wallets", description: "Borrower wallet management" },
  writeoffs: { label: "Write-Offs", description: "Loan write-off processing" },
  court: { label: "Court Cases", description: "Legal case management" },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  view: { label: "View", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  create: { label: "Create", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  update: { label: "Edit", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  delete: { label: "Delete", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  approve: { label: "Approve", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  manage: { label: "Manage", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  recommend: { label: "Recommend", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  verify_documents: { label: "Verify Docs", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  finance_approve: { label: "Finance Approve", color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  export: { label: "Export", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  record: { label: "Record", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  reverse: { label: "Reverse", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  blacklist: { label: "Blacklist", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-500/10 text-red-600 border-red-500/30",
  admin: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  loan_officer: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  credit_officer: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  finance_officer: "bg-green-500/10 text-green-600 border-green-500/30",
  collections_officer: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  auditor: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  support: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
};

const AdminRolesPermissions = () => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [originalPermissions, setOriginalPermissions] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, rpRes] = await Promise.all([
        supabase.from("roles").select("*").order("name"),
        supabase.from("permissions").select("*").order("module").order("action"),
        supabase.from("role_permissions").select("role_name, permission_id"),
      ]);

      if (rolesRes.data) {
        setRoles(rolesRes.data);
        if (!selectedRole && rolesRes.data.length > 0) {
          setSelectedRole(rolesRes.data[0].name);
        }
      }
      if (permsRes.data) setPermissions(permsRes.data);
      if (rpRes.data) {
        const set = new Set(rpRes.data.map((rp: any) => `${rp.role_name}:${rp.permission_id}`));
        setRolePermissions(set);
        setOriginalPermissions(new Set(set));
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load permissions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const permsByModule = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    });
    return grouped;
  }, [permissions]);

  const modules = useMemo(() => Object.keys(permsByModule).sort(), [permsByModule]);

  const hasPermission = (roleName: string, permId: string) => {
    return rolePermissions.has(`${roleName}:${permId}`);
  };

  const togglePermission = (roleName: string, permId: string) => {
    if (roleName === "super_admin") return; // super_admin always has all
    const key = `${roleName}:${permId}`;
    setRolePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModuleAll = (roleName: string, module: string) => {
    if (roleName === "super_admin") return;
    const modulePerms = permsByModule[module] || [];
    const allEnabled = modulePerms.every((p) => hasPermission(roleName, p.id));
    setRolePermissions((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p) => {
        const key = `${roleName}:${p.id}`;
        if (allEnabled) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    if (rolePermissions.size !== originalPermissions.size) return true;
    for (const key of rolePermissions) {
      if (!originalPermissions.has(key)) return true;
    }
    return false;
  }, [rolePermissions, originalPermissions]);

  const handleSave = async () => {
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Only admins can modify permissions", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Find changes for each role (except super_admin)
      const toInsert: { role_name: string; permission_id: string }[] = [];
      const toDelete: string[] = []; // keys "role:permId"

      for (const key of rolePermissions) {
        if (!originalPermissions.has(key)) {
          const [role_name, permission_id] = key.split(":");
          if (role_name !== "super_admin") toInsert.push({ role_name, permission_id });
        }
      }
      for (const key of originalPermissions) {
        if (!rolePermissions.has(key)) {
          toDelete.push(key);
        }
      }

      // Perform deletes
      for (const key of toDelete) {
        const [role_name, permission_id] = key.split(":");
        if (role_name === "super_admin") continue;
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_name", role_name)
          .eq("permission_id", permission_id);
      }

      // Perform inserts
      if (toInsert.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(toInsert);
        if (error) throw error;
      }

      setOriginalPermissions(new Set(rolePermissions));
      toast({ title: "Saved", description: `${toInsert.length} permissions added, ${toDelete.length} removed` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const editableRoles = roles.filter((r) => r.name !== "super_admin");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Roles & Permissions
            </h1>
            <p className="text-muted-foreground mt-1">
              Control what each staff role can view, edit, and manage across the system
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges || !isAdmin}
            className="gradient-primary"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {hasChanges ? "Save Changes" : "No Changes"}
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">Super Admin</strong> always has full access and cannot be modified.
              Toggle permissions for each role below. Changes take effect immediately after saving.
            </div>
          </CardContent>
        </Card>

        {/* Role Tabs */}
        <Tabs value={selectedRole} onValueChange={setSelectedRole}>
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
            {editableRoles.map((role) => (
              <TabsTrigger key={role.name} value={role.name} className="gap-2">
                <ShieldCheck size={14} />
                <span className="capitalize">{role.name.replace(/_/g, " ")}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {editableRoles.map((role) => {
            const rolePermsCount = permissions.filter((p) => hasPermission(role.name, p.id)).length;
            return (
              <TabsContent key={role.name} value={role.name} className="space-y-4 mt-4">
                {/* Role Summary */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={ROLE_COLORS[role.name] || ""}>
                    {role.name.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{role.description}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {rolePermsCount} / {permissions.length} permissions
                  </Badge>
                </div>

                {/* Module Cards */}
                <div className="grid gap-4">
                  {modules.map((mod) => {
                    const modPerms = permsByModule[mod];
                    const modInfo = MODULE_LABELS[mod] || { label: mod, description: "" };
                    const allEnabled = modPerms.every((p) => hasPermission(role.name, p.id));
                    const someEnabled = modPerms.some((p) => hasPermission(role.name, p.id));

                    return (
                      <Card key={mod} className="border-border/50">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  {modInfo.label}
                                  {allEnabled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                </CardTitle>
                                {modInfo.description && (
                                  <CardDescription className="text-xs mt-0.5">{modInfo.description}</CardDescription>
                                )}
                              </div>
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">All</span>
                                    <Switch
                                      checked={allEnabled}
                                      onCheckedChange={() => toggleModuleAll(role.name, mod)}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allEnabled ? "Revoke all" : "Grant all"} {modInfo.label} permissions
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                          <div className="flex flex-wrap gap-3">
                            {modPerms.map((perm) => {
                              const enabled = hasPermission(role.name, perm.id);
                              const actionInfo = ACTION_LABELS[perm.action] || { label: perm.action, color: "" };
                              return (
                                <TooltipProvider key={perm.id}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <label
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                          enabled
                                            ? actionInfo.color + " border-current/20"
                                            : "bg-muted/30 text-muted-foreground border-border/50 opacity-60"
                                        }`}
                                      >
                                        <Switch
                                          checked={enabled}
                                          onCheckedChange={() => togglePermission(role.name, perm.id)}
                                          className="scale-75"
                                        />
                                        <span className="text-sm font-medium">{actionInfo.label}</span>
                                      </label>
                                    </TooltipTrigger>
                                    <TooltipContent>{perm.description}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminRolesPermissions;
