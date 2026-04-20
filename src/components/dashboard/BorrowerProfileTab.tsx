import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Mail,
  Phone,
  LogOut,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Save,
  Loader2,
  Shield,
  Bell,
  FileText,
  Lock,
  Download,
} from "lucide-react";
import { exportBorrowerData } from "@/utils/exportBorrowerData";
import ProfileDocumentVault from "@/components/dashboard/ProfileDocumentVault";
import KYCFinancialInfo from "@/components/dashboard/KYCFinancialInfo";
import KYCNextOfKin from "@/components/dashboard/KYCNextOfKin";
import KYCReferences from "@/components/dashboard/KYCReferences";

interface Props {
  user: any;
  profile: any;
  kycVerified: boolean;
  /** Opens in-dashboard KYC sheet (borrower). Staff `?view=` still uses profile links. */
  onOpenKycWorkspace?: () => void;
  onSignOut: () => void;
}

type ProfileSectionTab = "personal" | "kyc" | "security" | "notifications";

function profileFormFromProfile(profile: any) {
  return {
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    nrc_number: profile?.nrc_number || "",
    address: profile?.address || "",
    city: profile?.city || "",
  };
}

function notificationFormFromProfile(profile: any) {
  return {
    email_reminders: profile?.email_reminders ?? true,
    sms_reminders: profile?.sms_reminders ?? true,
    payment_alerts: profile?.payment_alerts ?? true,
    marketing: profile?.marketing ?? false,
  };
}

export default function BorrowerProfileTab({ user, profile, kycVerified, onOpenKycWorkspace, onSignOut }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileTab, setProfileTab] = useState<ProfileSectionTab>("personal");

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    nrc_number: "",
    address: "",
    city: "",
  });
  const [notificationForm, setNotificationForm] = useState({
    email_reminders: true,
    sms_reminders: true,
    payment_alerts: true,
    marketing: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [unsavedDialog, setUnsavedDialog] = useState<
    null | { kind: "tab"; next: ProfileSectionTab } | { kind: "signout" }
  >(null);

  useEffect(() => {
    setProfileForm(profileFormFromProfile(profile));
    setNotificationForm(notificationFormFromProfile(profile));
  }, [profile]);

  const normalizedProfile = useMemo(
    () => ({
      full_name: (profile?.full_name || "").trim(),
      phone: (profile?.phone || "").trim(),
      nrc_number: (profile?.nrc_number || "").trim(),
      address: (profile?.address || "").trim(),
      city: (profile?.city || "").trim(),
    }),
    [profile],
  );

  const normalizedProfileForm = useMemo(
    () => ({
      full_name: profileForm.full_name.trim(),
      phone: profileForm.phone.trim(),
      nrc_number: profileForm.nrc_number.trim(),
      address: profileForm.address.trim(),
      city: profileForm.city.trim(),
    }),
    [profileForm],
  );

  const profileChanged = useMemo(
    () =>
      normalizedProfile.full_name !== normalizedProfileForm.full_name ||
      normalizedProfile.phone !== normalizedProfileForm.phone ||
      normalizedProfile.nrc_number !== normalizedProfileForm.nrc_number ||
      normalizedProfile.address !== normalizedProfileForm.address ||
      normalizedProfile.city !== normalizedProfileForm.city,
    [normalizedProfile, normalizedProfileForm],
  );

  const normalizedNotificationsFromProfile = useMemo(() => notificationFormFromProfile(profile), [profile]);

  const notificationsChanged = useMemo(
    () =>
      notificationForm.email_reminders !== normalizedNotificationsFromProfile.email_reminders ||
      notificationForm.sms_reminders !== normalizedNotificationsFromProfile.sms_reminders ||
      notificationForm.payment_alerts !== normalizedNotificationsFromProfile.payment_alerts ||
      notificationForm.marketing !== normalizedNotificationsFromProfile.marketing,
    [notificationForm, normalizedNotificationsFromProfile],
  );

  const passwordDirty = useMemo(
    () =>
      Boolean(
        passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword,
      ),
    [passwordForm],
  );

  const hasUnsavedEdits = useMemo(
    () =>
      (isEditingProfile && profileChanged) ||
      (isEditingNotifications && notificationsChanged) ||
      passwordDirty,
    [isEditingProfile, profileChanged, isEditingNotifications, notificationsChanged, passwordDirty],
  );

  const discardAllDrafts = useCallback(() => {
    setProfileForm(profileFormFromProfile(profile));
    setNotificationForm(notificationFormFromProfile(profile));
    setIsEditingProfile(false);
    setIsEditingNotifications(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }, [profile]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedEdits) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedEdits]);

  const profileValidationError = useMemo(() => {
    if (!normalizedProfileForm.full_name || normalizedProfileForm.full_name.length < 3) {
      return "Full name must be at least 3 characters.";
    }
    if (normalizedProfileForm.phone && !/^[0-9+\-\s]{9,15}$/.test(normalizedProfileForm.phone)) {
      return "Phone format is invalid.";
    }
    if (normalizedProfileForm.nrc_number && !/^[A-Za-z0-9/\-]{6,20}$/.test(normalizedProfileForm.nrc_number)) {
      return "NRC format is invalid.";
    }
    return "";
  }, [normalizedProfileForm]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Missing user");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          nrc_number: profileForm.nrc_number.trim() || null,
          address: profileForm.address.trim() || null,
          city: profileForm.city.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      setIsEditingProfile(false);
      toast({ title: "Profile updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save profile", description: e.message, variant: "destructive" });
    },
  });

  const saveNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Missing user");
      const { error } = await supabase
        .from("profiles")
        .update(notificationForm)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      setIsEditingNotifications(false);
      toast({ title: "Notification preferences saved" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save preferences", description: e.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const current = passwordForm.currentPassword;
      const pass = passwordForm.newPassword;
      const confirm = passwordForm.confirmPassword;
      if (!current) throw new Error("Enter your current password.");
      if (pass.length < 8) throw new Error("Password must be at least 8 characters.");
      if (pass !== confirm) throw new Error("Password confirmation does not match.");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: current,
      });
      if (reauthError) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password changed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not change password", description: e.message, variant: "destructive" });
    },
  });

  const handleTabChangeRequest = useCallback(
    (next: ProfileSectionTab) => {
      if (next === profileTab) return;
      if (!hasUnsavedEdits) {
        setProfileTab(next);
        return;
      }
      setUnsavedDialog({ kind: "tab", next });
    },
    [profileTab, hasUnsavedEdits],
  );

  const confirmDiscardAndProceed = useCallback(() => {
    if (!unsavedDialog) return;
    discardAllDrafts();
    if (unsavedDialog.kind === "tab") {
      setProfileTab(unsavedDialog.next);
    } else {
      onSignOut();
    }
    setUnsavedDialog(null);
  }, [unsavedDialog, discardAllDrafts, onSignOut]);

  const handleSignOutRequest = useCallback(() => {
    if (hasUnsavedEdits) setUnsavedDialog({ kind: "signout" });
    else onSignOut();
  }, [hasUnsavedEdits, onSignOut]);

  const profileCompletion = (() => {
    let score = 35;
    if (profile?.full_name) score += 20;
    if (profile?.phone) score += 15;
    if (profile?.address || profile?.city) score += 10;
    if (kycVerified) score += 20;
    return Math.min(100, score);
  })();

  return (
    <div className="space-y-6" data-testid="borrower-profile-tab">
      {/* User Info Card */}
      <Card className="border-border/60 shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0">
              {(profile?.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground">{profile?.full_name || "User"}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} />
                  {user?.email}
                </span>
                {profile?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} />
                    {profile.phone}
                  </span>
                )}
              </div>
              <div className="mt-2">
                {kycVerified ? (
                  <Badge className="bg-success/20 text-success border-success/30 border rounded-full px-2.5">
                    <CheckCircle size={12} className="mr-1" /> KYC Verified
                  </Badge>
                ) : (
                  <Badge className="bg-warning/20 text-warning border-warning/30 border rounded-full px-2.5">
                    <AlertTriangle size={12} className="mr-1" /> KYC Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="text-foreground font-medium">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
            <p className="text-[11px] text-muted-foreground">
              Complete your profile and KYC details to speed up approvals and support.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={unsavedDialog !== null} onOpenChange={(open) => !open && setUnsavedDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edits that are not saved yet. If you continue, those changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep editing</AlertDialogCancel>
            <AlertDialogAction type="button" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDiscardAndProceed}>
              Discard and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs
        value={profileTab}
        onValueChange={(v) => handleTabChangeRequest(v as ProfileSectionTab)}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-4" data-testid="borrower-profile-section-tabs">
          <TabsTrigger value="personal" className="gap-1.5" data-testid="borrower-profile-tab-personal">
            <User size={14} /> Personal
          </TabsTrigger>
          <TabsTrigger value="kyc" className="gap-1.5" data-testid="borrower-profile-tab-kyc">
            <FileText size={14} /> KYC
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5" data-testid="borrower-profile-tab-security">
            <Shield size={14} /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5" data-testid="borrower-profile-tab-notifications">
            <Bell size={14} /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="border-border/60 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle>Personal information</CardTitle>
              <CardDescription>Update your profile details used in support and onboarding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input
                    data-testid="borrower-profile-full-name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    data-testid="borrower-profile-phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>NRC number</Label>
                  <Input
                    value={profileForm.nrc_number}
                    onChange={(e) => setProfileForm((p) => ({ ...p, nrc_number: e.target.value }))}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={profileForm.city}
                    onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))}
                    disabled={!isEditingProfile}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                  disabled={!isEditingProfile}
                />
              </div>

              <div className="flex gap-2 justify-end">
                {isEditingProfile ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setProfileForm(profileFormFromProfile(profile));
                        setIsEditingProfile(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="hero"
                      data-testid="borrower-profile-save"
                      onClick={() => saveProfileMutation.mutate()}
                      disabled={saveProfileMutation.isPending || !profileChanged || Boolean(profileValidationError)}
                    >
                      {saveProfileMutation.isPending ? <Loader2 className="mr-2 animate-spin" size={14} /> : <Save className="mr-2" size={14} />}
                      Save profile
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="hero" data-testid="borrower-profile-edit" onClick={() => setIsEditingProfile(true)}>
                    Edit profile
                  </Button>
                )}
              </div>
              {isEditingProfile && profileValidationError && (
                <p className="text-sm text-destructive" data-testid="borrower-profile-validation-error">
                  {profileValidationError}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-6">
          {user?.id ? (
            <>
              <ProfileDocumentVault userId={user.id} />
              <KYCFinancialInfo userId={user.id} />
              <KYCNextOfKin userId={user.id} />
              <KYCReferences userId={user.id} />
            </>
          ) : (
            <Card className="border-border/60 shadow-card">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sign in to manage your KYC details.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-border/60 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><Lock size={16} /> Change password</CardTitle>
              <CardDescription>Use a strong password (minimum 8 characters).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="hero"
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={
                    changePasswordMutation.isPending ||
                    !passwordForm.currentPassword ||
                    passwordForm.newPassword.length < 8 ||
                    passwordForm.newPassword !== passwordForm.confirmPassword
                  }
                >
                  {changePasswordMutation.isPending ? <Loader2 className="mr-2 animate-spin" size={14} /> : <Lock className="mr-2" size={14} />}
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-border/60 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle>Notification preferences</CardTitle>
              <CardDescription>Choose how you receive reminders and updates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "email_reminders", label: "Email reminders" },
                { key: "sms_reminders", label: "SMS reminders" },
                { key: "payment_alerts", label: "Payment alerts" },
                { key: "marketing", label: "Marketing updates" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <p className="text-sm text-foreground">{item.label}</p>
                  <Switch
                    checked={Boolean(notificationForm[item.key as keyof typeof notificationForm])}
                    disabled={!isEditingNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationForm((p) => ({ ...p, [item.key]: checked }))
                    }
                  />
                </div>
              ))}

              <div className="flex gap-2 justify-end">
                {isEditingNotifications ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNotificationForm(notificationFormFromProfile(profile));
                        setIsEditingNotifications(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="hero"
                      onClick={() => saveNotificationsMutation.mutate()}
                      disabled={saveNotificationsMutation.isPending || !notificationsChanged}
                    >
                      {saveNotificationsMutation.isPending ? <Loader2 className="mr-2 animate-spin" size={14} /> : <Save className="mr-2" size={14} />}
                      Save preferences
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="hero" onClick={() => setIsEditingNotifications(true)}>
                    Edit preferences
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full md:w-auto"
        onClick={handleSignOutRequest}
      >
        <LogOut size={16} className="mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
