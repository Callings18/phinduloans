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
import { Shield, Plus, Search, UserCog, Trash2, Loader2, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

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
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState("loan_officer");
    const [searchResult, setSearchResult] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Fetch all staff
    const { data: staffList, isLoading } = useQuery({
        queryKey: ['staff-list'],
        queryFn: async () => {
            // 1. Get all roles checking for staff types
            const { data: roles, error: rolesError } = await supabase
                .from('user_roles')
                .select('*')
                .neq('role', 'user')
                .neq('role', 'employer');

            if (rolesError) throw rolesError;

            if (!roles || roles.length === 0) return [];

            // 2. Get profiles for these users
            const userIds = roles.map(r => r.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            // 3. Merge data
            return roles.map(role => {
                const profile = profiles?.find(p => p.id === role.user_id);
                return {
                    ...role,
                    profile: profile || { full_name: 'Unknown', email: 'Unknown' }
                };
            });
        }
    });

    // Search user mutation
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

            if (error) {
                toast.error("User not found");
            } else {
                setSearchResult(data);
            }
        } catch (e) {
            toast.error("Error searching user");
        } finally {
            setIsSearching(false);
        }
    };

    // Add/Update Staff Mutation
    const assignRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
            // Check if user already has a role
            const { data: existingRole } = await supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (existingRole) {
                const { error } = await supabase
                    .from('user_roles')
                    .update({ role: role as any })
                    .eq('id', existingRole.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('user_roles')
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
        onError: (error) => {
            console.error(error);
            toast.error("Failed to assign role");
        }
    });

    // Remove Staff Mutation (Demote to user)
    const removeStaffMutation = useMutation({
        mutationFn: async (roleId: string) => {
            const { error } = await supabase
                .from('user_roles')
                .update({ role: 'user' }) // Soft remove by setting to user
                .eq('id', roleId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] });
            toast.success("Staff member removed");
        },
        onError: () => toast.error("Failed to remove staff")
    });

    const getRoleBadge = (role: string) => {
        const config = STAFF_ROLES.find(r => r.value === role) ||
            { label: role, color: "bg-gray-100 text-gray-800" };

        return (
            <Badge variant="outline" className={`${config.color} capitalize`}>
                {config.label}
            </Badge>
        );
    };

    if (!canManageStaff) {
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-muted-foreground">You don&apos;t have permission to manage staff and roles.</p>
                        </CardContent>
                    </Card>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage system access and employee roles (RBAC)
                        </p>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="gradient-primary shadow-button">
                                <Plus size={18} className="mr-2" />
                                Add Staff
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Staff Member</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search by Email or NRC"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
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
                                            <label className="text-sm font-medium">Assign Role</label>
                                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STAFF_ROLES.map(role => (
                                                        <SelectItem key={role.value} value={role.value}>
                                                            {role.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {ROLE_DESCRIPTIONS[selectedRole] && (
                                                <p className="text-xs text-muted-foreground flex items-start gap-1">
                                                    <Info size={12} className="shrink-0 mt-0.5" />
                                                    {ROLE_DESCRIPTIONS[selectedRole]}
                                                </p>
                                            )}
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={() => assignRoleMutation.mutate({
                                                userId: searchResult.id,
                                                role: selectedRole
                                            })}
                                            disabled={assignRoleMutation.isPending}
                                        >
                                            {assignRoleMutation.isPending && <Loader2 className="animate-spin mr-2" />}
                                            Confirm Assignment
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

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
                                        <TableCell>
                                            {getRoleBadge(staff.role)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(staff.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="hover:text-primary">
                                                    <UserCog size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:text-destructive"
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to remove this staff member?')) {
                                                            removeStaffMutation.mutate(staff.id);
                                                        }
                                                    }}
                                                    disabled={staff.role === 'super_admin'}
                                                >
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
