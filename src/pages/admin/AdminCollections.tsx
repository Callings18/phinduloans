import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Search,
    Phone,
    Calendar,
    AlertCircle,
    History,
    MessageSquare,
    UserX,
    Clock,
    DollarSign,
    Filter,
    ArrowRight,
    Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";

const AdminCollections = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [daysOverdueFilter, setDaysOverdueFilter] = useState("all");
    const [selectedRepayment, setSelectedRepayment] = useState<any>(null);
    const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
    const [activityForm, setActivityForm] = useState({
        activity_type: "phone_call",
        notes: "",
        outcome: "promised_to_pay",
        promise_date: "",
        follow_up_date: "",
    });

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch overdue repayments
    const { data: overdueRepayments, isLoading } = useQuery({
        queryKey: ['overdue-repayments'],
        queryFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('loan_repayments')
                .select(`
          *,
          loan:loan_id (
            id,
            loan_amount,
            status,
            user_id,
            full_name,
            phone,
            email
          )
        `)
                .lt('due_date', today)
                .neq('status', 'paid')
                .order('due_date', { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    // Log Activity Mutation
    const logActivityMutation = useMutation({
        mutationFn: async (data: any) => {
            const user = (await supabase.auth.getUser()).data.user;
            const { error } = await supabase.from('collection_activities').insert({
                loan_id: selectedRepayment.loan_id,
                repayment_id: selectedRepayment.id,
                staff_id: user?.id,
                activity_type: data.activity_type,
                notes: data.notes,
                outcome: data.outcome,
                promise_date: data.promise_date || null,
                follow_up_date: data.follow_up_date || null,
            } as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overdue-repayments'] });
            toast({ title: "Success", description: "Collection activity logged" });
            setIsActivityDialogOpen(false);
            setActivityForm({
                activity_type: "phone_call",
                notes: "",
                outcome: "promised_to_pay",
                promise_date: "",
                follow_up_date: "",
            });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleLogActivity = () => {
        if (!activityForm.notes) {
            toast({ title: "Required", description: "Please enter notes", variant: "destructive" });
            return;
        }
        logActivityMutation.mutate(activityForm);
    };

    const filteredRepayments = overdueRepayments?.filter((item: any) => {
        const matchesSearch = item.loan.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.loan.phone?.includes(searchQuery);

        if (daysOverdueFilter === "all") return matchesSearch;

        const days = differenceInDays(new Date(), new Date(item.due_date));
        if (daysOverdueFilter === "1-30") return matchesSearch && days <= 30;
        if (daysOverdueFilter === "31-60") return matchesSearch && days > 30 && days <= 60;
        if (daysOverdueFilter === "61-90") return matchesSearch && days > 60 && days <= 90;
        if (daysOverdueFilter === "90+") return matchesSearch && days > 90;

        return matchesSearch;
    });

    const totalOverdueAmount = overdueRepayments?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Collections Management</h1>
                    <p className="text-muted-foreground mt-1">Track and recover overdue loan repayments</p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="glass border-border/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Overdue</p>
                                <p className="text-xl font-bold text-foreground">K{totalOverdueAmount.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                                <UserX size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Accounts at Risk</p>
                                <p className="text-xl font-bold text-foreground">{overdueRepayments?.length || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Avg. Days Overdue</p>
                                <p className="text-xl font-bold text-foreground">
                                    {overdueRepayments && overdueRepayments.length > 0
                                        ? Math.round(overdueRepayments.reduce((sum, item) => sum + differenceInDays(new Date(), new Date(item.due_date)), 0) / overdueRepayments.length)
                                        : 0} Days
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">PTPs Due Today</p>
                                <p className="text-xl font-bold text-foreground">0</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="glass border-border/50">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    placeholder="Search by borrower name or phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={daysOverdueFilter} onValueChange={setDaysOverdueFilter}>
                                <SelectTrigger className="w-full md:w-48">
                                    <Filter size={16} className="mr-2" />
                                    <SelectValue placeholder="Overdue Period" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Overdue</SelectItem>
                                    <SelectItem value="1-30">1 - 30 Days</SelectItem>
                                    <SelectItem value="31-60">31 - 60 Days</SelectItem>
                                    <SelectItem value="61-90">61 - 90 Days</SelectItem>
                                    <SelectItem value="90+">90+ Days (Write-off risk)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Overdue List */}
                <div className="grid grid-cols-1 gap-4">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-primary h-8 w-8" />
                        </div>
                    ) : filteredRepayments && filteredRepayments.length > 0 ? (
                        filteredRepayments.map((item: any) => {
                            const days = differenceInDays(new Date(), new Date(item.due_date));
                            let riskColor = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
                            if (days > 30) riskColor = "bg-orange-500/20 text-orange-500 border-orange-500/30";
                            if (days > 60) riskColor = "bg-red-500/20 text-red-500 border-red-500/30";

                            return (
                                <Card key={item.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${riskColor}`}>
                                                    <AlertCircle size={24} />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="font-semibold text-lg text-foreground">{item.loan.full_name}</h4>
                                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={14} />
                                                            {item.loan.phone}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={14} />
                                                            Due: {format(new Date(item.due_date), 'dd MMM yyyy')}
                                                        </span>
                                                        <Badge variant="outline" className={riskColor}>
                                                            {days} Days Overdue
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                                <div className="text-right sm:text-left">
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue Amount</p>
                                                    <p className="text-2xl font-bold text-red-500">K{Number(item.amount).toLocaleString()}</p>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <Button variant="outline" className="flex-1 sm:flex-none">
                                                        <Phone size={16} className="mr-2" />
                                                        Call
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedRepayment(item);
                                                            setIsActivityDialogOpen(true);
                                                        }}
                                                        className="flex-1 sm:flex-none gradient-primary"
                                                    >
                                                        <MessageSquare size={16} className="mr-2" />
                                                        Log Activity
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <Card className="border-dashed py-12">
                            <CardContent className="flex flex-col items-center text-center">
                                <DollarSign className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                <h3 className="text-lg font-medium">No overdue repayments found</h3>
                                <p className="text-muted-foreground">The portfolio is looking healthy!</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Log Activity Dialog */}
            <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log Collection Activity</DialogTitle>
                        <DialogDescription>
                            Record the outcome of your contact with {selectedRepayment?.loan.full_name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Activity Type</Label>
                            <Select
                                value={activityForm.activity_type}
                                onValueChange={(v) => setActivityForm({ ...activityForm, activity_type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="phone_call">Phone Call</SelectItem>
                                    <SelectItem value="sms">SMS Sent</SelectItem>
                                    <SelectItem value="email">Email Sent</SelectItem>
                                    <SelectItem value="site_visit">Site Visit</SelectItem>
                                    <SelectItem value="demand_letter">Demand Letter Issued</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Outcome</Label>
                            <Select
                                value={activityForm.outcome}
                                onValueChange={(v) => setActivityForm({ ...activityForm, outcome: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="promised_to_pay">Promised to Pay (PTP)</SelectItem>
                                    <SelectItem value="requested_extension">Requested Extension</SelectItem>
                                    <SelectItem value="unreachable">Unreachable</SelectItem>
                                    <SelectItem value="refused_to_pay">Refused to Pay</SelectItem>
                                    <SelectItem value="disputed">Disputed Amount</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {activityForm.outcome === 'promised_to_pay' && (
                            <div className="space-y-2">
                                <Label>Promise Date</Label>
                                <Input
                                    type="date"
                                    value={activityForm.promise_date}
                                    onChange={(e) => setActivityForm({ ...activityForm, promise_date: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                placeholder="Details of the conversation..."
                                value={activityForm.notes}
                                onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Next Follow-up Date</Label>
                            <Input
                                type="date"
                                value={activityForm.follow_up_date}
                                onChange={(e) => setActivityForm({ ...activityForm, follow_up_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleLogActivity}
                            disabled={logActivityMutation.isPending}
                            className="gradient-primary"
                        >
                            {logActivityMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                            Save Activity
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
};

export default AdminCollections;
