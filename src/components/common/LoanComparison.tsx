import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Scale,
    ArrowRight,
    Check,
    X,
    TrendingUp,
    Percent,
    Calendar,
    DollarSign,
    Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan } from "@/utils/loanCalculations";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface LoanProduct {
    id: string;
    name: string;
    description: string | null;
    min_amount: number;
    max_amount: number;
    min_term_months: number;
    max_term_months: number;
    interest_rate: number;
    interest_period: string | null;
    interest_type: string | null;
    processing_fee_percent: number | null;
    enforcement_fee_percent: number | null;
    insurance_percent: number | null;
    vat_percent: number | null;
    platform_fee_percent: number | null;
    collateral_required: boolean | null;
}

interface LoanComparisonProps {
    className?: string;
}

const LoanComparison = ({ className }: LoanComparisonProps) => {
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [comparisonAmount, setComparisonAmount] = useState(10000);
    const [comparisonTerm, setComparisonTerm] = useState(12);

    // Fetch loan products
    const { data: loanProducts, isLoading } = useQuery({
        queryKey: ['loan-products-comparison'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('loan_products')
                .select('*')
                .eq('is_active', true)
                .order('interest_rate', { ascending: true });

            if (error) throw error;
            return data as LoanProduct[];
        },
    });

    // Toggle product selection
    const toggleProduct = (productId: string) => {
        setSelectedProducts(prev => {
            if (prev.includes(productId)) {
                return prev.filter(id => id !== productId);
            }
            if (prev.length >= 3) {
                return [...prev.slice(1), productId]; // Replace oldest selection
            }
            return [...prev, productId];
        });
    };

    // Get selected products data
    const selectedProductsData = useMemo(() => {
        if (!loanProducts) return [];
        return selectedProducts
            .map(id => loanProducts.find(p => p.id === id))
            .filter(Boolean) as LoanProduct[];
    }, [selectedProducts, loanProducts]);

    // Calculate loan details for each product
    const comparisons = useMemo(() => {
        return selectedProductsData.map(product => {
            // Clamp amount and term to product limits
            const amount = Math.max(product.min_amount, Math.min(comparisonAmount, product.max_amount));
            const term = Math.max(product.min_term_months, Math.min(comparisonTerm, product.max_term_months));

            const calc = calculateLoan(amount, term, {
                interest_rate: product.interest_rate,
                interest_period: product.interest_period as any,
                interest_type: product.interest_type as any,
                processing_fee_percent: product.processing_fee_percent,
                enforcement_fee_percent: product.enforcement_fee_percent,
                insurance_percent: product.insurance_percent,
                vat_percent: product.vat_percent,
                platform_fee_percent: product.platform_fee_percent,
            });

            return {
                product,
                amount,
                term,
                ...calc,
            };
        });
    }, [selectedProductsData, comparisonAmount, comparisonTerm]);

    // Find best values for highlighting
    const bestValues = useMemo(() => {
        if (comparisons.length === 0) return { lowestRate: 0, lowestMonthly: 0, lowestTotal: 0 };
        return {
            lowestRate: Math.min(...comparisons.map(c => c.product.interest_rate)),
            lowestMonthly: Math.min(...comparisons.map(c => c.monthlyPayment)),
            lowestTotal: Math.min(...comparisons.map(c => c.totalRepayment)),
        };
    }, [comparisons]);

    if (isLoading) {
        return (
            <Card className={cn("glass border-border/50", className)}>
                <CardContent className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("glass border-border/50", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Scale className="text-primary" size={20} />
                    Compare Loan Products
                </CardTitle>
                <CardDescription>
                    Select up to 3 products to compare side-by-side
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Product Selection */}
                <div className="space-y-3">
                    <Label>Select Products to Compare</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {loanProducts?.map(product => (
                            <div
                                key={product.id}
                                onClick={() => toggleProduct(product.id)}
                                className={cn(
                                    "relative p-4 rounded-xl border cursor-pointer transition-all",
                                    selectedProducts.includes(product.id)
                                        ? "border-primary bg-primary/10 shadow-glow"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        checked={selectedProducts.includes(product.id)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-foreground text-sm">{product.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {product.interest_rate}% • K{product.min_amount.toLocaleString()}-K{product.max_amount.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Comparison Parameters */}
                {selectedProducts.length > 0 && (
                    <div className="p-4 rounded-xl bg-secondary/30 space-y-4">
                        <h4 className="font-medium text-foreground flex items-center gap-2">
                            <TrendingUp size={16} className="text-primary" />
                            Comparison Parameters
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Loan Amount</Label>
                                    <span className="text-primary font-bold">K{comparisonAmount.toLocaleString()}</span>
                                </div>
                                <Slider
                                    value={[comparisonAmount]}
                                    onValueChange={([v]) => setComparisonAmount(v)}
                                    min={500}
                                    max={100000}
                                    step={500}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Loan Term</Label>
                                    <span className="text-primary font-bold">{comparisonTerm} months</span>
                                </div>
                                <Slider
                                    value={[comparisonTerm]}
                                    onValueChange={([v]) => setComparisonTerm(v)}
                                    min={1}
                                    max={36}
                                    step={1}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Comparison Table */}
                {comparisons.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Feature</th>
                                    {comparisons.map((comp, i) => (
                                        <th key={comp.product.id} className="text-center py-3 px-4 min-w-[160px]">
                                            <div className="font-semibold text-foreground">{comp.product.name}</div>
                                            {i === 0 && comparisons.length > 1 && (
                                                <Badge className="mt-1 bg-primary/20 text-primary border-primary/30 text-xs">
                                                    Best Rate
                                                </Badge>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Interest Rate */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm flex items-center gap-1">
                                        <Percent size={14} />
                                        Interest Rate
                                    </td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4">
                                            <span className={cn(
                                                "font-semibold",
                                                comp.product.interest_rate === bestValues.lowestRate && comparisons.length > 1
                                                    ? "text-success"
                                                    : "text-foreground"
                                            )}>
                                                {comp.product.interest_rate}%
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-1">
                                                /{comp.product.interest_period || 'month'}
                                            </span>
                                        </td>
                                    ))}
                                </tr>

                                {/* Monthly Payment */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm flex items-center gap-1">
                                        <DollarSign size={14} />
                                        Monthly Payment
                                    </td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4">
                                            <span className={cn(
                                                "font-semibold",
                                                comp.monthlyPayment === bestValues.lowestMonthly && comparisons.length > 1
                                                    ? "text-success"
                                                    : "text-foreground"
                                            )}>
                                                K{comp.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    ))}
                                </tr>

                                {/* Total Repayment */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm flex items-center gap-1">
                                        <TrendingUp size={14} />
                                        Total Repayment
                                    </td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4">
                                            <span className={cn(
                                                "font-semibold",
                                                comp.totalRepayment === bestValues.lowestTotal && comparisons.length > 1
                                                    ? "text-success"
                                                    : "text-foreground"
                                            )}>
                                                K{comp.totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    ))}
                                </tr>

                                {/* Total Interest */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm">Total Interest</td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4 text-foreground font-medium">
                                            K{comp.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                    ))}
                                </tr>

                                {/* Fees */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm">Fees (Upfront)</td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4 text-foreground font-medium">
                                            K{comp.feesDeductedUpfront.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                    ))}
                                </tr>

                                {/* You Receive */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm">You Receive</td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4 text-primary font-bold">
                                            K{comp.disbursementAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                    ))}
                                </tr>

                                {/* Term */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm flex items-center gap-1">
                                        <Calendar size={14} />
                                        Term Range
                                    </td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4 text-foreground">
                                            {comp.product.min_term_months}-{comp.product.max_term_months} months
                                        </td>
                                    ))}
                                </tr>

                                {/* Collateral */}
                                <tr className="border-b border-border/50">
                                    <td className="py-3 px-4 text-muted-foreground text-sm">Collateral Required</td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-3 px-4">
                                            {comp.product.collateral_required ? (
                                                <X size={16} className="text-destructive mx-auto" />
                                            ) : (
                                                <Check size={16} className="text-success mx-auto" />
                                            )}
                                        </td>
                                    ))}
                                </tr>

                                {/* Apply Button */}
                                <tr>
                                    <td className="py-4 px-4"></td>
                                    {comparisons.map(comp => (
                                        <td key={comp.product.id} className="text-center py-4 px-4">
                                            <Button variant="hero" size="sm" asChild className="w-full">
                                                <Link to={`/apply?product=${comp.product.id}`}>
                                                    Apply Now
                                                    <ArrowRight size={14} className="ml-1" />
                                                </Link>
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Empty State */}
                {selectedProducts.length === 0 && (
                    <div className="text-center py-8">
                        <Scale className="mx-auto text-muted-foreground mb-4" size={48} />
                        <p className="text-muted-foreground">
                            Select products above to compare them side-by-side
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default LoanComparison;
