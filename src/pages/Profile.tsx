import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
    Eye,
    Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    nrc_number: string | null;
    address: string | null;
    city: string | null;
    avatar_url: string | null;
    created_at: string;
}

const Profile = () => {
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        nrc_number: "",
        address: "",
        city: "",
    });

    // Notification preferences state
    const [notifications, setNotifications] = useState({
        email_reminders: true,
        sms_reminders: true,
        payment_alerts: true,
        marketing: false,
    });

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
        }
    }, [user, authLoading, navigate]);

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

    // Fetch user's documents from applications
    const { data: documents } = useQuery({
        queryKey: ['user-documents', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            // @ts-expect-error - Table exists after migrations
            const { data, error } = await supabase
                .from('loan_application_documents')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
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
            });
        }
    }, [profile]);

    const handleSave = () => {
        updateProfileMutation.mutate(formData);
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
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="pt-24 pb-16">
                <div className="container mx-auto px-4 max-w-5xl">
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

                    {/* Tabs */}
                    <Tabs defaultValue="personal" className="space-y-6">
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

                        {/* Documents Tab */}
                        <TabsContent value="documents">
                            <Card className="glass border-border/50">
                                <CardHeader>
                                    <CardTitle>Document Vault</CardTitle>
                                    <CardDescription>View documents you've uploaded for loan applications</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {documents && documents.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {documents.map((doc: any) => (
                                                <div
                                                    key={doc.id}
                                                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                                            <FileText className="text-primary" size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-foreground text-sm">{doc.document_type?.replace(/_/g, ' ')}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {doc.created_at ? format(new Date(doc.created_at), 'MMM dd, yyyy') : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge className={
                                                            doc.status === 'verified'
                                                                ? 'bg-success/20 text-success border-success/30'
                                                                : doc.status === 'rejected'
                                                                    ? 'bg-destructive/20 text-destructive border-destructive/30'
                                                                    : 'bg-warning/20 text-warning border-warning/30'
                                                        }>
                                                            {doc.status || 'pending'}
                                                        </Badge>
                                                        {doc.file_url && (
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                                                    <Eye size={16} />
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                                                <FileText className="text-muted-foreground" size={32} />
                                            </div>
                                            <h3 className="text-lg font-semibold text-foreground mb-2">No Documents</h3>
                                            <p className="text-muted-foreground">Documents uploaded during loan applications will appear here</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
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
                                                <Shield className="text-primary" size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-foreground">Password</h4>
                                                <p className="text-sm text-muted-foreground">Change your account password</p>
                                            </div>
                                        </div>
                                        <Button variant="outline">Change Password</Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h4 className="font-medium text-foreground">Recent Activity</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Last Login</span>
                                                <span className="text-foreground">{format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Account Created</span>
                                                <span className="text-foreground">
                                                    {profile?.created_at ? format(new Date(profile.created_at), 'MMM dd, yyyy') : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
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
                                        <Button variant="hero">
                                            <Save size={16} className="mr-2" />
                                            Save Preferences
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Profile;
