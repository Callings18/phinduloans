import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import ProfileDocumentVault from "@/components/dashboard/ProfileDocumentVault";
import KYCFinancialInfo from "@/components/dashboard/KYCFinancialInfo";
import KYCNextOfKin from "@/components/dashboard/KYCNextOfKin";
import KYCReferences from "@/components/dashboard/KYCReferences";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@phinduloans/shared/components/ui/avatar";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    FileText,
    Shield,
    Bell,
    Save,
    Loader2,
    Edit2,
    CheckCircle,
    Clock,
    Calendar,
    CreditCard,
    ArrowLeft,
    Home,
    LogOut,
    Lock,
    Eye,
    EyeOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@phinduloans/shared/components/ui/dialog";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { format } from "date-fns";
import { borrowerDashboardHrefFromLegacyProfileTab } from "@/utils/borrowerDashboardLinks";

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    nrc_number: string | null;
    address: string | null;
    city: string | null;
    avatar_url: string | null;
    email_reminders?: boolean | null;
    sms_reminders?: boolean | null;
    payment_alerts?: boolean | null;
    marketing?: boolean | null;
    employer_name?: string | null;
    job_title?: string | null;
    employment_type?: string | null;
    years_in_employment?: number | null;
    net_income?: number | null;
    created_at: string;
}

const PROFILE_TABS = ["personal", "documents", "security", "notifications"] as const;
type ProfileSettingsTab = (typeof PROFILE_TABS)[number];

const Profile = () => {
    const { user, isLoading: authLoading, isStaff } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        nrc_number: "",
        address: "",
        city: "",
        employer_name: "",
        job_title: "",
        employment_type: "permanent",
        years_in_employment: "",
        net_income: "",
    });

    // Notification preferences state
    const [notifications, setNotifications] = useState({
        email_reminders: true,
        sms_reminders: true,
        payment_alerts: true,
        marketing: false,
    });
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const profileTab = useMemo((): ProfileSettingsTab => {
        const raw = searchParams.get("tab");
        return PROFILE_TABS.includes(raw as ProfileSettingsTab) ? (raw as ProfileSettingsTab) : "personal";
    }, [searchParams]);

    const setProfileTab = useCallback(
        (value: string) => {
            const next = new URLSearchParams(searchParams);
            if (value === "personal") next.delete("tab");
            else next.set("tab", value);
            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams],
    );

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
        }
    }, [user, authLoading, navigate]);

    /** Borrowers use the dashboard profile module; keep `/profile` for staff `?view=` preview only. */
    useEffect(() => {
        if (authLoading || !user) return;
        if (searchParams.has("view")) return;
        if (isStaff) return;

        const legacyTab = searchParams.get("tab");
        navigate(borrowerDashboardHrefFromLegacyProfileTab(legacyTab), { replace: true });
    }, [authLoading, user, isStaff, searchParams, navigate]);

    useEffect(() => {
        if (!authLoading && user && isStaff && !searchParams.has("view")) {
            navigate("/admin", { replace: true });
        }
    }, [user, authLoading, isStaff, navigate, searchParams]);

    // Fetch profile
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data as Profile;
        },
        enabled: !!user?.id,
    });



    // Fetch loan applications summary
    const { data: applicationsSummary } = useQuery({
        queryKey: ['applications-summary', user?.id],
        queryFn: async () => {
            if (!user?.id) return { total: 0, approved: 0, pending: 0, rejected: 0 };
            const { data, error } = await supabase
                .from('loan_applications')
                .select('status')
                .eq('user_id', user.id);

            if (error) throw error;

            const statuses = (data || []).map(d => d.status);
            return {
                total: statuses.length,
                approved: statuses.filter(s => s === 'approved' || s === 'disbursed' || s === 'active').length,
                pending: statuses.filter(s => s === 'pending' || s === 'under_review').length,
                rejected: statuses.filter(s => s === 'rejected').length,
            };
        },
        enabled: !!user?.id,
    });

    // Update profile mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: Partial<Profile>) => {
            if (!user?.id) throw new Error('Not authenticated');
            const { error } = await supabase
                .from('profiles')
                .update(data)
                .eq('id', user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
            }
            setIsEditing(false);
            toast({
                title: "Profile Updated",
                description: "Your profile has been updated successfully.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update profile",
                variant: "destructive",
            });
        },
    });

    // Populate form when profile loads
    useEffect(() => {
        if (profile) {
            setFormData({
                full_name: profile.full_name || "",
                phone: profile.phone || "",
                nrc_number: profile.nrc_number || "",
                address: profile.address || "",
                city: profile.city || "",
                employer_name: (profile as any).employer_name || "",
                job_title: (profile as any).job_title || "",
                employment_type: (profile as any).employment_type || "permanent",
                years_in_employment: (profile as any).years_in_employment?.toString() || "",
                net_income: (profile as any).net_income?.toString() || "",
            });
            // Load notification preferences from profile
            setNotifications({
                email_reminders: profile.email_reminders ?? true,
                sms_reminders: profile.sms_reminders ?? true,
                payment_alerts: profile.payment_alerts ?? true,
                marketing: profile.marketing ?? false,
            });
        }
    }, [profile]);

    const handleSave = () => {
        const saveData: any = {
            ...formData,
            years_in_employment: formData.years_in_employment ? parseInt(formData.years_in_employment, 10) : null,
            net_income: formData.net_income ? parseFloat(formData.net_income) : null,
        };
        updateProfileMutation.mutate(saveData);
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            toast({ title: "Password too short", description: "Minimum 6 characters required", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Passwords don't match", variant: "destructive" });
            return;
        }
        setIsChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast({ title: "Password Changed", description: "Your password has been updated successfully." });
            setShowPasswordDialog(false);
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            toast({ title: "Failed to change password", description: error.message, variant: "destructive" });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
            navigate("/auth");
        } catch {
            toast({ title: "Logout failed", variant: "destructive" });
            setIsLoggingOut(false);
        }
    };

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    if (authLoading || profileLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <main className="pt-8 pb-24">
                <div className="container mx-auto px-4 max-w-5xl">
                    {/* Back to Dashboard */}
                    <Button
                        variant="ghost"
                        className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ArrowLeft size={18} />
                        Back to Dashboard
                    </Button>
                    {/* Profile Header */}
                    <Card className="glass border-border/50 mb-8">
                        <CardContent className="p-8">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-primary/20">
                                    <AvatarImage src={profile?.avatar_url || undefined} />
                                    <AvatarFallback className="text-2xl md:text-3xl gradient-primary text-primary-foreground">
                                        {getInitials(profile?.full_name)}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 text-center md:text-left">
                                    <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                                        {profile?.full_name || "User"}
                                    </h1>
                                    <p className="text-muted-foreground mb-4">{profile?.email}</p>

                                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                            <CreditCard size={14} className="mr-1" />
                                            {applicationsSummary?.total || 0} Applications
                                        </Badge>
                                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                                            <CheckCircle size={14} className="mr-1" />
                                            {applicationsSummary?.approved || 0} Approved
                                        </Badge>
                                        <Badge variant="outline" className="bg-secondary text-muted-foreground border-border">
                                            <Calendar size={14} className="mr-1" />
                                            Member since {profile?.created_at ? format(new Date(profile.created_at), 'MMM yyyy') : 'N/A'}
                                        </Badge>
                                    </div>
                                </div>

                                <Button
                                    variant={isEditing ? "outline" : "hero"}
                                    onClick={() => setIsEditing(!isEditing)}
                                >
                                    {isEditing ? (
                                        <>Cancel</>
                                    ) : (
                                        <>
                                            <Edit2 size={16} className="mr-2" />
                                            Edit Profile
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs — `?tab=documents|security|notifications` matches dashboard profile links */}
                    <Tabs value={profileTab} onValueChange={setProfileTab} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="personal" className="flex items-center gap-2">
                                <User size={16} />
                                <span className="hidden sm:inline">Personal</span>
                            </TabsTrigger>
                            <TabsTrigger value="documents" className="flex items-center gap-2">
                                <FileText size={16} />
                                <span className="hidden sm:inline">Documents</span>
                            </TabsTrigger>
                            <TabsTrigger value="security" className="flex items-center gap-2">
                                <Shield size={16} />
                                <span className="hidden sm:inline">Security</span>
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="flex items-center gap-2">
                                <Bell size={16} />
                                <span className="hidden sm:inline">Notifications</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Personal Info Tab */}
                        <TabsContent value="personal">
                            <Card className="glass border-border/50">
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                    <CardDescription>Manage your personal details</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="full_name">Full Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                                <Input
                                                    id="full_name"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="pl-10"
                                                    placeholder="Your full name"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email Address</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                                <Input
                                                    id="email"
                                                    value={profile?.email || ""}
                                                    disabled
                                                    className="pl-10 bg-secondary/50"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Phone Number</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                                <Input
                                                    id="phone"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="pl-10"
                                                    placeholder="+260 967 713 001"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="nrc">NRC Number</Label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                                <Input
                                                    id="nrc"
                                                    value={formData.nrc_number}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, nrc_number: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="pl-10"
                                                    placeholder="XXXXXX/XX/X"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="city">City</Label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                                <Input
                                                    id="city"
                                                    value={formData.city}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="pl-10"
                                                    placeholder="City"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="address">Residential Address</Label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                                <Input
                                                    id="address"
                                                    value={formData.address}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="pl-10"
                                                    placeholder="Full address"
                                                />
                                            </div>
                                        </div>

                                        {/* Employment & Income Details */}
                                        <div className="md:col-span-2 pt-4">
                                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                                                <Briefcase size={16} className="text-primary" />
                                                Employment & Income
                                            </h4>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="employer_name">Place of Work</Label>
                                            <Input
                                                id="employer_name"
                                                value={formData.employer_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, employer_name: e.target.value }))}
                                                disabled={!isEditing}
                                                placeholder="Employer name"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="job_title">Position</Label>
                                            <Input
                                                id="job_title"
                                                value={formData.job_title}
                                                onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                                                disabled={!isEditing}
                                                placeholder="Job title / position"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="employment_type">Employment Type</Label>
                                            <select
                                                id="employment_type"
                                                value={formData.employment_type}
                                                onChange={(e) => setFormData(prev => ({ ...prev, employment_type: e.target.value }))}
                                                disabled={!isEditing}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="permanent">Permanent</option>
                                                <option value="contract">Contract</option>
                                                <option value="casual">Casual</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="years_in_employment">Years in Employment</Label>
                                            <Input
                                                id="years_in_employment"
                                                type="number"
                                                value={formData.years_in_employment}
                                                onChange={(e) => setFormData(prev => ({ ...prev, years_in_employment: e.target.value }))}
                                                disabled={!isEditing}
                                                placeholder="e.g. 5"
                                                min={0}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="net_income">Net Income (ZMW)</Label>
                                            <Input
                                                id="net_income"
                                                type="number"
                                                value={formData.net_income}
                                                onChange={(e) => setFormData(prev => ({ ...prev, net_income: e.target.value }))}
                                                disabled={!isEditing}
                                                placeholder="Monthly net income"
                                                min={0}
                                            />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="flex justify-end">
                                            <Button
                                                variant="hero"
                                                onClick={handleSave}
                                                disabled={updateProfileMutation.isPending}
                                            >
                                                {updateProfileMutation.isPending ? (
                                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                                ) : (
                                                    <Save size={16} className="mr-2" />
                                                )}
                                                Save Changes
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Documents Tab - KYC Vault with Upload */}
                        <TabsContent value="documents" className="space-y-6">
                            <ProfileDocumentVault userId={user?.id || ""} />
                            <KYCFinancialInfo userId={user?.id || ""} />
                            <KYCNextOfKin userId={user?.id || ""} />
                            <KYCReferences userId={user?.id || ""} />
                        </TabsContent>

                        {/* Security Tab */}
                        <TabsContent value="security">
                            <Card className="glass border-border/50">
                                <CardHeader>
                                    <CardTitle>Security Settings</CardTitle>
                                    <CardDescription>Manage your account security</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                <Lock className="text-primary" size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-foreground">Password</h4>
                                                <p className="text-sm text-muted-foreground">Change your account password</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>Change Password</Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h4 className="font-medium text-foreground">Account</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Member since</span>
                                                <span className="text-foreground">
                                                    {profile?.created_at ? format(new Date(profile.created_at), 'MMM dd, yyyy') : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Log Out */}
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                                                <LogOut className="text-destructive" size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-foreground">Log Out</h4>
                                                <p className="text-sm text-muted-foreground">Sign out of your account</p>
                                            </div>
                                        </div>
                                        <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
                                            {isLoggingOut ? <Loader2 size={16} className="mr-2 animate-spin" /> : <LogOut size={16} className="mr-2" />}
                                            Log Out
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Notifications Tab */}
                        <TabsContent value="notifications">
                            <Card className="glass border-border/50">
                                <CardHeader>
                                    <CardTitle>Notification Preferences</CardTitle>
                                    <CardDescription>Control how you receive notifications</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                            <div className="flex items-center gap-4">
                                                <Mail className="text-primary" size={20} />
                                                <div>
                                                    <h4 className="font-medium text-foreground">Email Reminders</h4>
                                                    <p className="text-sm text-muted-foreground">Receive payment reminders via email</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={notifications.email_reminders}
                                                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_reminders: checked }))}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                            <div className="flex items-center gap-4">
                                                <Phone className="text-primary" size={20} />
                                                <div>
                                                    <h4 className="font-medium text-foreground">SMS Reminders</h4>
                                                    <p className="text-sm text-muted-foreground">Receive payment reminders via SMS</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={notifications.sms_reminders}
                                                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sms_reminders: checked }))}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                            <div className="flex items-center gap-4">
                                                <Bell className="text-primary" size={20} />
                                                <div>
                                                    <h4 className="font-medium text-foreground">Payment Alerts</h4>
                                                    <p className="text-sm text-muted-foreground">Get instant notifications for payment confirmations</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={notifications.payment_alerts}
                                                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, payment_alerts: checked }))}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                            <div className="flex items-center gap-4">
                                                <Briefcase className="text-muted-foreground" size={20} />
                                                <div>
                                                    <h4 className="font-medium text-foreground">Marketing & Promotions</h4>
                                                    <p className="text-sm text-muted-foreground">Receive updates about new products and offers</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={notifications.marketing}
                                                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, marketing: checked }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button 
                                            variant="hero"
                                            onClick={async () => {
                                                setIsSavingNotifications(true);
                                                try {
                                                    if (!user?.id) throw new Error('Not authenticated');
                                                    const { error } = await supabase
                                                        .from('profiles')
                                                        .update({
                                                            email_reminders: notifications.email_reminders,
                                                            sms_reminders: notifications.sms_reminders,
                                                            payment_alerts: notifications.payment_alerts,
                                                            marketing: notifications.marketing,
                                                        })
                                                        .eq('id', user.id);

                                                    if (error) throw error;
                                                    
                                                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                                                    queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
                                                    toast({
                                                        title: "Preferences Saved",
                                                        description: "Your notification preferences have been updated successfully.",
                                                    });
                                                } catch (error: any) {
                                                    toast({
                                                        title: "Save Failed",
                                                        description: error.message || "Failed to save notification preferences",
                                                        variant: "destructive",
                                                    });
                                                } finally {
                                                    setIsSavingNotifications(false);
                                                }
                                            }}
                                            disabled={isSavingNotifications}
                                        >
                                            {isSavingNotifications ? (
                                                <Loader2 size={16} className="mr-2 animate-spin" />
                                            ) : (
                                                <Save size={16} className="mr-2" />
                                            )}
                                            Save Preferences
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            {/* Sticky bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-lg">
                <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between py-3">
                    <p className="text-sm text-muted-foreground hidden sm:block">
                        Done updating? Head back to your dashboard.
                    </p>
                    <Button
                        variant="hero"
                        onClick={() => navigate('/dashboard')}
                        className="ml-auto gap-2"
                    >
                        <Home size={16} />
                        Go to Dashboard
                    </Button>
                </div>
            </div>

            {/* Change Password Dialog */}
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>Enter your new password below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
                        <Button variant="hero" onClick={handleChangePassword} disabled={isChangingPassword}>
                            {isChangingPassword ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Lock size={16} className="mr-2" />}
                            Update Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Profile;
