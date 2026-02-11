import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Plus, Search, UserCog, Trash2, Loader2, Info, UserPlus, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Label } from "@/components/ui/label";

const STAFF_ROLES = [
    { value: "super_admin", label: "Super Admin", color: "bg-red-500/10 text-red-500 border-red-500/20" },
    { value: "admin", label: "Admin", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
    { value: "loan_officer", label: "Loan Officer", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    { value: "credit_officer", label: "Credit Officer", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
    { value: "finance_officer", label: "Finance Officer", color: "bg-green-500/10 text-green-500 border-green-500/20" },
    { value: "collections_officer", label: "Collections", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    { value: "auditor", label: "Auditor", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
    { value: "support", label: "Support", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
    super_admin: "Full access: all modules",
    admin: "Admin: all modules",
    loan_officer: "Loans: view, verify documents, assign, edit; Borrowers: view",
    credit_officer: "Loans: view, assign; Reports: view; Borrowers: view",
    finance_officer: "Loans: view, finance approve; Disbursement: view, disburse; Reports: view, export",
    collections_officer: "Loans, Borrowers, Reports: view",
    auditor: "Reports, Audit: view, export",
    support: "Loans, Borrowers: view (read-only)",
};

const AdminStaff = () => {
    const { user: currentUser, isAdmin } = useAuth();
    const { can } = usePermissions();
    const canManageStaff = can("settings", "manage") || isAdmin;
    const queryClient = useQueryClient();

    // Existing user search/assign dialog
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState("loan_officer");
    const [searchResult, setSearchResult] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Create new staff dialog
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ email: "", full_name: "", phone: "", role: "loan_officer" });
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
    const [copied, setCopied] = useState(false);

    // Edit role dialog
    const [editingStaff, setEditingStaff] = useState<any>(null);
    const [editRole, setEditRole] = useState("");

    // Fetch all staff
    const { data: staffList, isLoading } = useQuery({
        queryKey: ['staff-list'],
        queryFn: async () => {
            const { data: roles, error: rolesError } = await supabase
                .from('user_roles')
                .select('*')
                .neq('role', 'user')
                .neq('role', 'employer');
            if (rolesError) throw rolesError;
            if (!roles || roles.length === 0) return [];

            const userIds = roles.map(r => r.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', userIds);
            if (profilesError) throw profilesError;

            return roles.map(role => {
                const profile = profiles?.find(p => p.id === role.user_id);
                return { ...role, profile: profile || { full_name: 'Unknown', email: 'Unknown' } };
            });
        }
    });

    // Search existing user
    const searchUser = async () => {
        if (!searchTerm) return;
        setIsSearching(true);
        setSearchResult(null);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`email.eq.${searchTerm},nrc_number.eq.${searchTerm}`)
                .single();
            if (error) toast.error("User not found");
            else setSearchResult(data);
        } catch { toast.error("Error searching user"); }
        finally { setIsSearching(false); }
    };

    // Assign role to existing user
    const assignRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
            const { data: existingRole } = await supabase
                .from('user_roles').select('*').eq('user_id', userId).maybeSingle();
            if (existingRole) {
                const { error } = await supabase.from('user_roles')
                    .update({ role: role as any }).eq('id', existingRole.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('user_roles')
                    .insert({ user_id: userId, role: role as any });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] });
            setIsAddOpen(false);
            setSearchResult(null);
            setSearchTerm("");
            toast.success("Staff role assigned successfully");
        },
        onError: () => toast.error("Failed to assign role"),
    });

    // Create new staff user via edge function
    const createStaffMutation = useMutation({
        mutationFn: async (form: typeof createForm) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const res = await supabase.functions.invoke("create-staff-user", {
                body: form,
            });
            if (res.error) throw new Error(res.error.message || "Failed to create user");
            if (res.data?.error) throw new Error(res.data.error);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] });
            setCreatedCredentials({ email: createForm.email, password: data.temp_password });
            setCreateForm({ email: "", full_name: "", phone: "", role: "loan_officer" });
            toast.success("Staff user created successfully");
        },
        onError: (error: Error) => toast.error(error.message),
    });

    // Edit role mutation
    const editRoleMutation = useMutation({
        mutationFn: async ({ roleRecordId, newRole }: { roleRecordId: string; newRole: string }) => {
            const { error } = await supabase.from('user_roles')
                .update({ role: newRole as any }).eq('id', roleRecordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] });
            setEditingStaff(null);
            toast.success("Role updated successfully");
        },
        onError: () => toast.error("Failed to update role"),
    });

    // Remove staff
    const removeStaffMutation = useMutation({
        mutationFn: async (roleId: string) => {
            const { error } = await supabase.from('user_roles')
                .update({ role: 'user' }).eq('id', roleId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] });
            toast.success("Staff member removed");
        },
        onError: () => toast.error("Failed to remove staff"),
    });

    const getRoleBadge = (role: string) => {
        const config = STAFF_ROLES.find(r => r.value === role) || { label: role, color: "bg-gray-100 text-gray-800" };
        return <Badge variant="outline" className={`${config.color} capitalize`}>{config.label}</Badge>;
    };

    const handleCopyCredentials = () => {
        if (!createdCredentials) return;
        navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!canManageStaff) {
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
                    <Card><CardContent className="p-6">
                        <p className="text-muted-foreground">You don&apos;t have permission to manage staff and roles.</p>
                    </CardContent></Card>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
                        <p className="text-muted-foreground mt-1">Manage system access and employee roles (RBAC)</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Create New Staff User */}
                        <Dialog open={isCreateOpen} onOpenChange={(open) => {
                            setIsCreateOpen(open);
                            if (!open) setCreatedCredentials(null);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="gradient-primary shadow-button">
                                    <UserPlus size={18} className="mr-2" />Create Staff User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Staff User</DialogTitle>
                                </DialogHeader>
                                {createdCredentials ? (
                                    <div className="space-y-4 py-4">
                                        <div className="p-4 border rounded-lg bg-green-500/10 border-green-500/20 space-y-3">
                                            <p className="font-medium text-green-600">✅ User created successfully!</p>
                                            <p className="text-sm text-muted-foreground">
                                                Share these credentials securely with the new staff member. They should change their password on first login.
                                            </p>
                                            <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                                                <p>Email: <span className="text-foreground">{createdCredentials.email}</span></p>
                                                <p>Temp Password: <span className="text-foreground">{createdCredentials.password}</span></p>
                                            </div>
                                            <Button variant="outline" className="w-full" onClick={handleCopyCredentials}>
                                                {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                                                {copied ? "Copied!" : "Copy Credentials"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Full Name *</Label>
                                            <Input placeholder="John Mwale" value={createForm.full_name}
                                                onChange={(e) => setCreateForm(f => ({ ...f, full_name: e.target.value }))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email *</Label>
                                            <Input type="email" placeholder="john@company.com" value={createForm.email}
                                                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone (optional)</Label>
                                            <Input placeholder="+260 9XX XXX XXX" value={createForm.phone}
                                                onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Role *</Label>
                                            <Select value={createForm.role} onValueChange={(v) => setCreateForm(f => ({ ...f, role: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {STAFF_ROLES.map(r => (
                                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {ROLE_DESCRIPTIONS[createForm.role] && (
                                                <p className="text-xs text-muted-foreground flex items-start gap-1">
                                                    <Info size={12} className="shrink-0 mt-0.5" />{ROLE_DESCRIPTIONS[createForm.role]}
                                                </p>
                                            )}
                                        </div>
                                        <Button className="w-full" disabled={!createForm.email || !createForm.full_name || createStaffMutation.isPending}
                                            onClick={() => createStaffMutation.mutate(createForm)}>
                                            {createStaffMutation.isPending && <Loader2 className="animate-spin mr-2" />}
                                            Create Staff User
                                        </Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>

                        {/* Assign Existing User */}
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Plus size={18} className="mr-2" />Assign Existing User</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Assign Role to Existing User</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="flex gap-2">
                                        <Input placeholder="Search by Email or NRC" value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)} />
                                        <Button variant="secondary" onClick={searchUser} disabled={isSearching}>
                                            {isSearching ? <Loader2 className="animate-spin" /> : <Search size={18} />}
                                        </Button>
                                    </div>
                                    {searchResult && (
                                        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={searchResult.avatar_url} />
                                                    <AvatarFallback>{searchResult.full_name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{searchResult.full_name}</p>
                                                    <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Assign Role</Label>
                                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {STAFF_ROLES.map(r => (
                                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {ROLE_DESCRIPTIONS[selectedRole] && (
                                                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                                                        <Info size={12} className="shrink-0 mt-0.5" />{ROLE_DESCRIPTIONS[selectedRole]}
                                                    </p>
                                                )}
                                            </div>
                                            <Button className="w-full" disabled={assignRoleMutation.isPending}
                                                onClick={() => assignRoleMutation.mutate({ userId: searchResult.id, role: selectedRole })}>
                                                {assignRoleMutation.isPending && <Loader2 className="animate-spin mr-2" />}
                                                Confirm Assignment
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Edit Role Dialog */}
                <Dialog open={!!editingStaff} onOpenChange={(open) => { if (!open) setEditingStaff(null); }}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Edit Staff Role</DialogTitle></DialogHeader>
                        {editingStaff && (
                            <div className="space-y-4 py-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={editingStaff.profile?.avatar_url} />
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            {editingStaff.profile?.full_name?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{editingStaff.profile?.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{editingStaff.profile?.email}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Current Role</Label>
                                    <div>{getRoleBadge(editingStaff.role)}</div>
                                </div>
                                <div className="space-y-2">
                                    <Label>New Role</Label>
                                    <Select value={editRole} onValueChange={setEditRole}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {STAFF_ROLES.map(r => (
                                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {ROLE_DESCRIPTIONS[editRole] && (
                                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                                            <Info size={12} className="shrink-0 mt-0.5" />{ROLE_DESCRIPTIONS[editRole]}
                                        </p>
                                    )}
                                </div>
                                <Button className="w-full" disabled={editRoleMutation.isPending || editRole === editingStaff.role}
                                    onClick={() => editRoleMutation.mutate({ roleRecordId: editingStaff.id, newRole: editRole })}>
                                    {editRoleMutation.isPending && <Loader2 className="animate-spin mr-2" />}
                                    Update Role
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle>Active Staff Members</CardTitle>
                        <CardDescription>Users with elevated privileges</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Staff Member</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Assigned At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : staffList?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No staff members found. Create one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : staffList?.map((staff: any) => (
                                    <TableRow key={staff.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={staff.profile?.avatar_url} />
                                                    <AvatarFallback className="bg-primary/10 text-primary">
                                                        {staff.profile?.full_name?.charAt(0) || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{staff.profile?.full_name || 'Unknown User'}</p>
                                                    <p className="text-xs text-muted-foreground">{staff.profile?.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getRoleBadge(staff.role)}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(staff.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="hover:text-primary"
                                                    onClick={() => { setEditingStaff(staff); setEditRole(staff.role); }}>
                                                    <UserCog size={16} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="hover:text-destructive"
                                                    disabled={staff.role === 'super_admin'}
                                                    onClick={() => {
                                                        if (confirm('Remove this staff member?')) removeStaffMutation.mutate(staff.id);
                                                    }}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AdminStaff;
