import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@phinduloans/shared/components/ui/card";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { ShieldCheck, AlertCircle, CheckCircle, XCircle, Loader2, CreditCard, Shield } from "lucide-react";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { CRBCheckModule } from "./CRBCheckModule";
import { GuaranteeCheckModule } from "./GuaranteeCheckModule";

interface RiskAssessmentModuleProps {
    applicationId: string;
    borrowerId?: string;
    nrcNumber?: string;
    fullName?: string;
    dateOfBirth?: string;
    consentObtained?: boolean;
    loanAmount?: number;
    loanTermMonths?: number;
    loanProductId?: string;
    employerName?: string;
    monthlyIncome?: number;
}

interface RiskAssessment {
    id: string;
    loan_application_id: string;
    credit_score: number | null;
    risk_rating: string | null;
    decision: string | null;
    admin_notes: string | null;
    items: any;
    assessed_by: string | null;
    created_at: string;
}

interface LoanProduct {
    crb_check_required?: boolean;
    guarantee_required?: boolean;
    guarantee_provider?: string;
    max_guarantee_percent?: number;
}

const initialFormData = {
    credit_score: "",
    risk_rating: "medium",
    decision: "more_info",
    admin_notes: "",
    items: {
        kyc_verified: false,
        employment_verified: false,
        income_verified: false,
        collateral_verified: false,
        crb_check_passed: false,
        guarantee_obtained: false,
    }
};

const RiskAssessmentModule = ({ 
    applicationId, 
    borrowerId,
    nrcNumber,
    fullName,
    dateOfBirth,
    consentObtained,
    loanAmount,
    loanTermMonths,
    loanProductId,
    employerName,
    monthlyIncome
}: RiskAssessmentModuleProps) => {
    const { user, hasRole, isAdmin } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState(initialFormData);

    // Fetch loan product settings
    const { data: loanProduct } = useQuery({
        queryKey: ['loan-product-settings', loanProductId],
        queryFn: async () => {
            if (!loanProductId) return null;
            const { data, error } = await supabase
                .from('loan_products')
                .select('crb_check_required, guarantee_required, guarantee_provider, max_guarantee_percent')
                .eq('id', loanProductId)
                .maybeSingle();
            if (error) throw error;
            return data as LoanProduct | null;
        },
        enabled: !!loanProductId
    });

    const { data: assessment, isLoading } = useQuery({
        queryKey: ['risk-assessment', applicationId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('risk_assessments' as any)
                .select('*')
                .eq('loan_application_id', applicationId)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                const assessmentData = data as unknown as RiskAssessment;
                setFormData({
                    credit_score: assessmentData.credit_score?.toString() || "",
                    risk_rating: assessmentData.risk_rating || "medium",
                    decision: assessmentData.decision || "more_info",
                    admin_notes: assessmentData.admin_notes || "",
                    items: (assessmentData.items as any) || {
                        kyc_verified: false,
                        employment_verified: false,
                        income_verified: false,
                        collateral_verified: false,
                        crb_check_passed: false,
                        guarantee_obtained: false,
                    }
                });
            }
            return data as unknown as RiskAssessment;
        }
    });

    // Reset form when switching to an application with no assessment
    useEffect(() => {
        if (!isLoading && assessment === null) {
            setFormData(initialFormData);
        }
    }, [applicationId, isLoading, assessment]);

    const saveMutation = useMutation({
        mutationFn: async (vars: typeof formData) => {
            const payload = {
                loan_application_id: applicationId,
                credit_score: vars.credit_score ? parseInt(vars.credit_score) : null,
                risk_rating: vars.risk_rating,
                decision: vars.decision,
                admin_notes: vars.admin_notes,
                items: vars.items,
                assessed_by: user?.id,
            };

            if (assessment?.id) {
                const { error } = await supabase
                    .from('risk_assessments' as any)
                    .update(payload)
                    .eq('id', assessment.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('risk_assessments' as any)
                    .insert(payload);
                if (error) throw error;
            }

            if (vars.decision === 'approve' || vars.decision === 'reject') {
                const newStatus = vars.decision === 'approve' ? 'under_review' : 'rejected';
                await supabase
                    .from('loan_applications')
                    .update({ status: newStatus as any })
                    .eq('id', applicationId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['risk-assessment', applicationId] });
            queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
            toast({ title: "Risk assessment saved" });
            setIsEditing(false);
        },
        onError: (error: any) => {
            toast({ title: "Error saving assessment", description: error.message, variant: "destructive" });
        }
    });

    const canEdit = hasRole('credit_officer') || isAdmin;

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const showCRBModule = loanProduct?.crb_check_required || true; // Show by default for flexibility
    const showGuaranteeModule = loanProduct?.guarantee_required || true;

    return (
        <div className="space-y-6">
            <Tabs defaultValue="assessment" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="assessment" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Risk Analysis
                    </TabsTrigger>
                    <TabsTrigger value="crb" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        CRB Check
                        {loanProduct?.crb_check_required && (
                            <Badge variant="outline" className="ml-1 text-xs">Required</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="guarantee" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Guarantee
                        {loanProduct?.guarantee_required && (
                            <Badge variant="outline" className="ml-1 text-xs">Required</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="assessment" className="mt-4">
                    <Card className="bg-secondary/10 border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <ShieldCheck className="text-primary" />
                                    Risk Analysis
                                </CardTitle>
                                <CardDescription>Credit score and risk categorization</CardDescription>
                            </div>
                            {canEdit && !isEditing && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    {assessment ? "Update Assessment" : "Start Review"}
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {!isEditing && assessment ? (
                                <div className="grid grid-cols-2 gap-6 mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Credit Score</Label>
                                            <p className="text-2xl font-bold text-foreground">{assessment.credit_score || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Risk Rating</Label>
                                            <div className="mt-1">
                                                <Badge className={
                                                    assessment.risk_rating === 'low' ? "bg-green-500/20 text-green-400" :
                                                        assessment.risk_rating === 'medium' ? "bg-yellow-500/20 text-yellow-400" :
                                                            "bg-red-500/20 text-red-400"
                                                }>
                                                    {assessment.risk_rating?.toUpperCase()} RISK
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Current Decision</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                {assessment.decision === 'approve' ? <CheckCircle className="text-green-500" size={18} /> :
                                                    assessment.decision === 'reject' ? <XCircle className="text-red-500" size={18} /> :
                                                        <AlertCircle className="text-yellow-500" size={18} />}
                                                <span className="font-medium capitalize">{assessment.decision?.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Notes</Label>
                                            <p className="text-sm text-foreground italic">"{assessment.admin_notes || 'No notes added'}"</p>
                                        </div>
                                    </div>
                                </div>
                            ) : isEditing ? (
                                <div className="space-y-6 mt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Credit Score (Internal)</Label>
                                            <Input
                                                type="number"
                                                value={formData.credit_score}
                                                onChange={(e) => setFormData({ ...formData, credit_score: e.target.value })}
                                                placeholder="0 - 1000"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Risk Rating</Label>
                                            <Select value={formData.risk_rating} onValueChange={(v) => setFormData({ ...formData, risk_rating: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="low">Low Risk</SelectItem>
                                                    <SelectItem value="medium">Medium Risk</SelectItem>
                                                    <SelectItem value="high">High Risk</SelectItem>
                                                    <SelectItem value="critical">Critical Risk</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Verification Checklist</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(formData.items).map(([key, val]) => (
                                                <div key={key} className="flex items-center gap-2 p-2 rounded border border-border/50 bg-background/50">
                                                    <input
                                                        type="checkbox"
                                                        checked={val as boolean}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            items: { ...formData.items, [key]: e.target.checked }
                                                        })}
                                                        id={key}
                                                    />
                                                    <Label htmlFor={key} className="text-xs uppercase cursor-pointer">{key.replace(/_/g, ' ')}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Recommended Decision</Label>
                                        <Select value={formData.decision} onValueChange={(v) => setFormData({ ...formData, decision: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="approve">Recommend Approval</SelectItem>
                                                <SelectItem value="more_info">Need More Info</SelectItem>
                                                <SelectItem value="reject">Recommend Rejection</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Admin Notes</Label>
                                        <Textarea
                                            value={formData.admin_notes}
                                            onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                                            placeholder="Detailed findings..."
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                                        <Button className="flex-1" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                                            {saveMutation.isPending && <Loader2 className="animate-spin mr-2" />}
                                            Save Assessment
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center text-muted-foreground">
                                    <ShieldCheck className="mx-auto mb-3 opacity-20" size={48} />
                                    <p>No risk assessment has been performed for this application.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="crb" className="mt-4">
                    {showCRBModule && (
                        <CRBCheckModule
                            applicationId={applicationId}
                            borrowerId={borrowerId || ''}
                            nrcNumber={nrcNumber || ''}
                            fullName={fullName || ''}
                            dateOfBirth={dateOfBirth || ''}
                            consentObtained={consentObtained || false}
                            productCrbRequired={loanProduct?.crb_check_required || false}
                        />
                    )}
                </TabsContent>

                <TabsContent value="guarantee" className="mt-4">
                    {showGuaranteeModule && (
                        <GuaranteeCheckModule
                            applicationId={applicationId}
                            borrowerId={borrowerId || ''}
                            borrowerNrc={nrcNumber || ''}
                            borrowerName={fullName || ''}
                            employerName={employerName}
                            monthlyIncome={monthlyIncome}
                            loanAmount={loanAmount || 0}
                            loanTermMonths={loanTermMonths || 12}
                            guaranteeProvider={loanProduct?.guarantee_provider || 'pmic'}
                            guaranteeRequired={loanProduct?.guarantee_required || false}
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default RiskAssessmentModule;
