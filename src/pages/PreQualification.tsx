import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Calculator,
    ArrowRight,
    Sparkles,
    DollarSign,
    Briefcase,
    TrendingUp,
    Shield,
    Lightbulb
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calculateLoan } from "@/utils/loanCalculations";

interface LoanProduct {
    id: string;
    name: string;
    min_amount: number;
    max_amount: number;
    min_term_months: number;
    max_term_months: number;
    interest_rate: number;
    interest_period: string | null;
    interest_type: string | null;
}

interface EligibilityResult {
    status: 'eligible' | 'maybe' | 'not_eligible';
    score: number;
    maxAmount: number;
    dti: number;
    reasons: string[];
    tips: string[];
    recommendedProducts: LoanProduct[];
}

const PreQualification = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        monthlyIncome: "",
        monthlyExpenses: "",
        existingDebt: "",
        employmentType: "",
        employmentDuration: "",
        age: "",
    });
    const [result, setResult] = useState<EligibilityResult | null>(null);

    // Fetch loan products
    const { data: loanProducts } = useQuery({
        queryKey: ['loan-products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('loan_products')
                .select('*')
                .eq('is_active', true)
                .order('min_amount', { ascending: true });

            if (error) throw error;
            return data as LoanProduct[];
        },
    });

    const calculateEligibility = () => {
        const income = parseFloat(formData.monthlyIncome) || 0;
        const expenses = parseFloat(formData.monthlyExpenses) || 0;
        const existingDebt = parseFloat(formData.existingDebt) || 0;
        const age = parseInt(formData.age) || 0;

        // Calculate Debt-to-Income Ratio
        const totalDebtPayments = existingDebt;
        const dti = income > 0 ? (totalDebtPayments / income) * 100 : 100;

        // Calculate disposable income
        const disposableIncome = income - expenses - existingDebt;

        // Max loan amount (based on 40% of disposable income for monthly payment)
        const maxMonthlyPayment = disposableIncome * 0.4;
        const maxAmount = Math.max(0, maxMonthlyPayment * 12); // Rough estimate

        let score = 0;
        const reasons: string[] = [];
        const tips: string[] = [];

        // Income score (0-30 points)
        if (income >= 5000) {
            score += 30;
        } else if (income >= 3000) {
            score += 20;
        } else if (income >= 1500) {
            score += 10;
            tips.push("Higher income may qualify you for larger loan amounts");
        } else {
            reasons.push("Monthly income is below minimum requirement");
            tips.push("Consider additional income sources or co-applicant");
        }

        // DTI score (0-25 points)
        if (dti < 30) {
            score += 25;
        } else if (dti < 40) {
            score += 15;
        } else if (dti < 50) {
            score += 5;
            tips.push("Reducing existing debt can improve your eligibility");
        } else {
            reasons.push("Debt-to-income ratio is too high");
            tips.push("Pay down existing debts before applying");
        }

        // Employment score (0-25 points)
        if (formData.employmentType === 'permanent') {
            score += 20;
            if (formData.employmentDuration === '2+') {
                score += 5;
            }
        } else if (formData.employmentType === 'contract') {
            score += 10;
            tips.push("Permanent employment can improve your eligibility");
        } else if (formData.employmentType === 'self-employed') {
            score += 15;
            if (formData.employmentDuration !== '2+') {
                tips.push("Longer business history can improve eligibility");
            }
        } else {
            reasons.push("Employment type not specified");
        }

        // Employment duration (0-10 points)
        if (formData.employmentDuration === '2+') {
            score += 10;
        } else if (formData.employmentDuration === '1-2') {
            score += 7;
        } else if (formData.employmentDuration === '6-12') {
            score += 4;
            tips.push("Longer employment history improves loan terms");
        } else {
            tips.push("Minimum 6 months employment typically required");
        }

        // Age score (0-10 points)
        if (age >= 21 && age <= 55) {
            score += 10;
        } else if (age >= 18 && age < 21) {
            score += 5;
            tips.push("Some products may require age 21+");
        } else if (age > 55) {
            score += 5;
            tips.push("Loan term may be limited based on retirement age");
        } else {
            reasons.push("Must be at least 18 years old");
        }

        // Determine status
        let status: 'eligible' | 'maybe' | 'not_eligible';
        
        // HARD DISQUALIFICATION: DTI over 60% is too risky
        if (dti > 60) {
            status = 'not_eligible';
            reasons.push("Debt-to-income ratio exceeds maximum allowed (60%)");
            tips.push("Your existing debt payments are too high relative to your income. Pay down existing debts before applying.");
        } else if (score >= 70) {
            status = 'eligible';
        } else if (score >= 40) {
            status = 'maybe';
        } else {
            status = 'not_eligible';
        }

        // Find recommended products
        const recommendedProducts = (loanProducts || []).filter(p =>
            maxAmount >= p.min_amount
        ).slice(0, 3);

        setResult({
            status,
            score,
            maxAmount: Math.round(maxAmount / 100) * 100,
            dti: Math.round(dti * 10) / 10,
            reasons,
            tips,
            recommendedProducts,
        });

        setStep(3);
    };

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const statusConfig = {
        eligible: {
            icon: CheckCircle,
            color: 'text-success',
            bgColor: 'bg-success/10',
            borderColor: 'border-success/30',
            title: 'Great News! You Pre-Qualify',
            description: 'Based on your information, you appear to meet our eligibility criteria.',
        },
        maybe: {
            icon: AlertTriangle,
            color: 'text-warning',
            bgColor: 'bg-warning/10',
            borderColor: 'border-warning/30',
            title: 'You May Qualify',
            description: 'Your eligibility is borderline. Consider the tips below to improve your chances.',
        },
        not_eligible: {
            icon: XCircle,
            color: 'text-destructive',
            bgColor: 'bg-destructive/10',
            borderColor: 'border-destructive/30',
            title: 'Sorry, You Do Not Qualify',
            description: 'Based on the information provided, you do not currently meet our lending criteria.',
        },
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="pt-24 pb-16">
                <div className="container mx-auto px-4 max-w-3xl">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
                            <Calculator className="text-primary-foreground" size={28} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            Check Your <span className="text-gradient">Eligibility</span>
                        </h1>
                        <p className="text-muted-foreground max-w-xl mx-auto">
                            Get an instant pre-qualification result without affecting your credit score.
                            This is a soft check to see if you may qualify for a loan.
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="mb-8">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Step {step} of 3</span>
                            <span className="text-sm text-primary font-medium">{Math.round((step / 3) * 100)}%</span>
                        </div>
                        <Progress value={(step / 3) * 100} className="h-2" />
                    </div>

                    {/* Step 1: Income Details */}
                    {step === 1 && (
                        <Card className="glass border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="text-primary" size={20} />
                                    Income & Expenses
                                </CardTitle>
                                <CardDescription>Tell us about your financial situation</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="monthlyIncome">Monthly Income (ZMW) *</Label>
                                        <Input
                                            id="monthlyIncome"
                                            type="number"
                                            placeholder="e.g. 5000"
                                            value={formData.monthlyIncome}
                                            onChange={(e) => updateFormData("monthlyIncome", e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">Your gross monthly salary</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="monthlyExpenses">Monthly Expenses (ZMW) *</Label>
                                        <Input
                                            id="monthlyExpenses"
                                            type="number"
                                            placeholder="e.g. 2000"
                                            value={formData.monthlyExpenses}
                                            onChange={(e) => updateFormData("monthlyExpenses", e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">Rent, utilities, etc.</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="existingDebt">Existing Debt Payments (ZMW)</Label>
                                    <Input
                                        id="existingDebt"
                                        type="number"
                                        placeholder="e.g. 500"
                                        value={formData.existingDebt}
                                        onChange={(e) => updateFormData("existingDebt", e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Monthly payments on existing loans</p>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        variant="hero"
                                        onClick={() => setStep(2)}
                                        disabled={!formData.monthlyIncome || !formData.monthlyExpenses}
                                    >
                                        Continue
                                        <ArrowRight size={18} className="ml-2" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 2: Employment Details */}
                    {step === 2 && (
                        <Card className="glass border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="text-primary" size={20} />
                                    Employment Details
                                </CardTitle>
                                <CardDescription>Tell us about your employment</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Employment Type *</Label>
                                        <Select
                                            value={formData.employmentType}
                                            onValueChange={(v) => updateFormData("employmentType", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="permanent">Permanent Employee</SelectItem>
                                                <SelectItem value="contract">Contract Employee</SelectItem>
                                                <SelectItem value="self-employed">Self-Employed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Employment Duration *</Label>
                                        <Select
                                            value={formData.employmentDuration}
                                            onValueChange={(v) => updateFormData("employmentDuration", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="How long?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0-6">Less than 6 months</SelectItem>
                                                <SelectItem value="6-12">6-12 months</SelectItem>
                                                <SelectItem value="1-2">1-2 years</SelectItem>
                                                <SelectItem value="2+">More than 2 years</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="age">Your Age *</Label>
                                    <Input
                                        id="age"
                                        type="number"
                                        placeholder="e.g. 30"
                                        value={formData.age}
                                        onChange={(e) => updateFormData("age", e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-between">
                                    <Button variant="outline" onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                    <Button
                                        variant="hero"
                                        onClick={calculateEligibility}
                                        disabled={!formData.employmentType || !formData.employmentDuration || !formData.age}
                                    >
                                        Check Eligibility
                                        <Sparkles size={18} className="ml-2" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 3: Results */}
                    {step === 3 && result && (
                        <div className="space-y-6">
                            {/* Result Card */}
                            <Card className={cn(
                                "glass border-2",
                                statusConfig[result.status].borderColor
                            )}>
                                <CardContent className="p-8 text-center">
                                    <div className={cn(
                                        "inline-flex items-center justify-center w-20 h-20 rounded-full mb-6",
                                        statusConfig[result.status].bgColor
                                    )}>
                                        {(() => {
                                            const Icon = statusConfig[result.status].icon;
                                            return <Icon className={statusConfig[result.status].color} size={40} />;
                                        })()}
                                    </div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">
                                        {statusConfig[result.status].title}
                                    </h2>
                                    <p className="text-muted-foreground mb-6">
                                        {statusConfig[result.status].description}
                                    </p>

                                    {/* Score */}
                                    <div className="inline-flex items-center gap-4 p-4 rounded-xl bg-secondary/50 mb-6">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Eligibility Score</p>
                                            <p className="text-3xl font-bold text-primary">{result.score}/100</p>
                                        </div>
                                        <div className="h-12 w-px bg-border" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Est. Max Amount</p>
                                            <p className="text-3xl font-bold text-foreground">K{result.maxAmount.toLocaleString()}</p>
                                        </div>
                                        <div className="h-12 w-px bg-border" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Debt-to-Income</p>
                                            <p className="text-3xl font-bold text-foreground">{result.dti}%</p>
                                        </div>
                                    </div>

                                    {result.status === 'eligible' && (
                                        <Button variant="hero" size="lg" asChild>
                                            <Link to="/apply">
                                                Apply Now
                                                <ArrowRight size={20} className="ml-2" />
                                            </Link>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Recommended Products */}
                            {result.recommendedProducts.length > 0 && result.status !== 'not_eligible' && (
                                <Card className="glass border-border/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <TrendingUp className="text-primary" size={20} />
                                            Recommended Products
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {result.recommendedProducts.map((product) => (
                                                <div
                                                    key={product.id}
                                                    className="p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/50 transition-colors"
                                                >
                                                    <h4 className="font-semibold text-foreground mb-2">{product.name}</h4>
                                                    <div className="space-y-1 text-sm text-muted-foreground">
                                                        <p>K{product.min_amount.toLocaleString()} - K{product.max_amount.toLocaleString()}</p>
                                                        <p>{product.interest_rate}% interest</p>
                                                        <p>{product.min_term_months}-{product.max_term_months} months</p>
                                                    </div>
                                                    <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                                                        <Link to={`/apply?product=${product.id}`}>
                                                            Apply for this
                                                        </Link>
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Tips to Improve */}
                            {result.tips.length > 0 && (
                                <Card className="glass border-border/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Lightbulb className="text-warning" size={20} />
                                            Tips to Improve Your Eligibility
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-3">
                                            {result.tips.map((tip, index) => (
                                                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center font-medium">
                                                        {index + 1}
                                                    </span>
                                                    {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Reasons (if not eligible) */}
                            {result.reasons.length > 0 && (
                                <Card className="glass border-destructive/30">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-destructive">
                                            <Shield className="text-destructive" size={20} />
                                            Areas of Concern
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {result.reasons.map((reason, index) => (
                                                <li key={index} className="flex items-center gap-2 text-muted-foreground">
                                                    <XCircle className="text-destructive flex-shrink-0" size={16} />
                                                    {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Start Over */}
                            <div className="text-center">
                                <Button variant="outline" onClick={() => { setStep(1); setResult(null); }}>
                                    Check Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Info Note */}
                    {step < 3 && (
                        <div className="mt-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                <Shield size={14} className="inline mr-1" />
                                This is a soft pre-qualification check. It does not affect your credit score.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default PreQualification;
