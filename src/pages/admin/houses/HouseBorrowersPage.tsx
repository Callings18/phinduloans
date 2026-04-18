import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useHouseBorrowers, useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { Search, User, Plus, Phone, IdCard, MapPin, CreditCard } from "lucide-react";
import PaginationControls from "@/components/common/PaginationControls";

const zambianCities = [
  "Lusaka", "Kitwe", "Ndola", "Kabwe", "Chingola", "Mufulira", "Luanshya",
  "Livingstone", "Kasama", "Chipata", "Chinsali", "Mansa", "Solwezi",
  "Mongu", "Mazabuka", "Monze", "Kalomo", "Choma", "Kafue",
  "Chililabombwe", "Kapiri Mposhi", "Nakonde", "Mbala", "Mpika", "Petauke"
].sort();

export default function HouseBorrowersPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: borrowers, isLoading } = useHouseBorrowers(productCode);
  const { data: loans } = useHouseLoans(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", nrc_number: "", address: "", city: "Lusaka",
    principal_amount: "", interest_amount: "", daily_repayment: "",
    loan_start_date: new Date().toISOString().slice(0, 10),
  });

  // Loan counts per borrower
  const loanCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (loans ?? []).forEach((l: any) => { map[l.user_id] = (map[l.user_id] || 0) + 1; });
    return map;
  }, [loans]);

  // Active loan amounts per borrower
  const activeLoanAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    (loans ?? []).forEach((l: any) => {
      if (["active", "disbursed", "approved"].includes(l.status)) {
        map[l.user_id] = (map[l.user_id] || 0) + Number(l.loan_amount || 0);
      }
    });
    return map;
  }, [loans]);

  const filtered = useMemo(() => {
    if (!borrowers) return [];
    const q = search.toLowerCase();
    return borrowers.filter((b: any) =>
      b.full_name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.phone?.toLowerCase().includes(q) ||
      b.nrc_number?.toLowerCase().includes(q)
    );
  }, [borrowers, search]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Fetch product id for onboarding
  const { data: productData } = useQuery({
    queryKey: ["house-product-id", productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name")
        .eq("product_code", productCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(productCode),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.email.trim()) throw new Error("Name and email are required.");
      const response = await supabase.functions.invoke("create-borrower", {
        body: {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          nrc_number: form.nrc_number || null,
          address: form.address || null,
          city: form.city || null,
        },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      const userId = response.data?.user_id;
      if (!userId) return response.data;

      // Optionally create a loan + auto-disburse so repayment schedule generates
      const principal = Number(form.principal_amount || 0);
      const interest = Number(form.interest_amount || 0);
      const daily = Number(form.daily_repayment || 0);
      if (principal > 0 && productData?.id) {
        const total = principal + Math.max(0, interest);
        const termDays = daily > 0 ? Math.max(1, Math.round(total / daily)) : 26;
        const isMarketeer = productCode === "MARKETEER";
        const { data: loan, error: loanErr } = await supabase
          .from("loan_applications")
          .insert({
            user_id: userId,
            loan_product_id: productData.id,
            full_name: form.full_name,
            email: form.email,
            phone: form.phone || "N/A",
            nrc_number: form.nrc_number || "N/A",
            address: form.address || "",
            city: form.city || "",
            employment_type: (isMarketeer ? "self_employed" : "employed") as any,
            employer_name: isMarketeer ? "Marketeers" : "",
            monthly_income: Math.max(principal * 2, 500),
            loan_amount: principal,
            loan_purpose: `${productData.name || productCode} loan`,
            loan_term_months: termDays,
            term_unit: "days",
            interest_rate: principal > 0 ? (interest / principal) * 100 : 0,
            monthly_payment: daily > 0 ? daily : Math.round(total / termDays),
            total_repayment: total,
            status: "approved" as const,
            approved_at: `${form.loan_start_date}T08:00:00.000Z`,
            source: `house_${productCode.toLowerCase()}`,
          })
          .select("id")
          .single();
        if (loanErr) throw new Error(`Loan creation failed: ${loanErr.message}`);

        // Auto-create completed disbursement → triggers schedule generation
        if (loan?.id) {
          const { error: disbErr } = await supabase.from("disbursements").insert({
            loan_id: loan.id,
            amount: principal,
            disbursement_method: "cash",
            status: "completed",
            disbursed_at: `${form.loan_start_date}T08:00:00.000Z`,
            transaction_reference: `HOUSE-${productCode}-${Date.now()}`,
          });
          if (disbErr) throw new Error(`Disbursement failed: ${disbErr.message}`);
        }
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["house-borrowers", productCode] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
      queryClient.invalidateQueries({ queryKey: ["admin-borrowers"] });
      toast({ title: data?.existing ? "Borrower already existed" : "Borrower added", description: data?.message });
      setIsAddOpen(false);
      setForm({ full_name: "", email: "", phone: "", nrc_number: "", address: "", city: "Lusaka", principal_amount: "", interest_amount: "", daily_repayment: "", loan_start_date: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Borrowers</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} borrower(s) in this product house</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} size="sm">
          <Plus size={16} className="mr-1" /> Add Borrower
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{borrowers?.length || 0}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{Object.keys(activeLoanAmounts).length}</p><p className="text-xs text-muted-foreground">With Active Loans</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">K{Object.values(activeLoanAmounts).reduce((a, b) => a + b, 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Active Portfolio</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{(loans ?? []).length}</p><p className="text-xs text-muted-foreground">Total Loans</p></CardContent></Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Search by name, email, phone, or NRC..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : paginated.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((b: any) => (
              <Link key={b.id} to={`/admin/houses/${productCode}/borrowers/${b.id}`} className="block">
                <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                        <User className="text-primary-foreground" size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{b.full_name || "Unknown"}</h4>
                        <p className="text-xs text-muted-foreground truncate">{b.email}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {b.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={13} /><span>{b.phone}</span></div>}
                      {b.nrc_number && <div className="flex items-center gap-2 text-muted-foreground"><IdCard size={13} /><span>{b.nrc_number}</span></div>}
                      {b.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={13} /><span>{b.city}</span></div>}
                      <div className="flex items-center gap-2 text-muted-foreground"><CreditCard size={13} /><span>{loanCounts[b.id] || 0} loan(s)</span></div>
                      {activeLoanAmounts[b.id] ? (
                        <Badge variant="outline" className="text-xs mt-1">Active: K{activeLoanAmounts[b.id].toLocaleString()}</Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <PaginationControls currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
        </>
      ) : (
        <Card><CardContent className="p-8 text-center"><User className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No borrowers found</p></CardContent></Card>
      )}

      {/* Add Borrower Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Borrower to {productData?.name || productCode}</DialogTitle>
            <DialogDescription>Create a new borrower profile. Fields marked with * are required.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Section 1: Personal Information */}
            <section className="space-y-3">
              <header className="flex items-center gap-2 border-b border-border/60 pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>
                <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Full Name *</Label>
                  <Input autoFocus value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>NRC Number</Label>
                  <Input value={form.nrc_number} onChange={(e) => setForm(f => ({ ...f, nrc_number: e.target.value }))} placeholder="123456/78/1" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+260 967 713 001" />
                </div>
              </div>
            </section>

            {/* Section 2: Contact & Address */}
            <section className="space-y-3">
              <header className="flex items-center gap-2 border-b border-border/60 pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>
                <h3 className="text-sm font-semibold text-foreground">Contact & Address</h3>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={form.city} onValueChange={(v) => setForm(f => ({ ...f, city: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{zambianCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address..." rows={2} />
                </div>
              </div>
            </section>

            {/* Section 3: Loan Onboarding */}
            <section className="border border-border/60 rounded-lg p-4 space-y-3 bg-secondary/20">
              <header className="flex items-center gap-2 border-b border-border/60 pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">3</span>
                <h3 className="text-sm font-semibold text-foreground">Loan Onboarding <span className="text-xs font-normal text-muted-foreground">(optional)</span></h3>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Principal</Label><Input type="number" value={form.principal_amount} onChange={(e) => setForm(f => ({ ...f, principal_amount: e.target.value }))} placeholder="1000" /></div>
                <div className="space-y-1"><Label className="text-xs">Interest</Label><Input type="number" value={form.interest_amount} onChange={(e) => setForm(f => ({ ...f, interest_amount: e.target.value }))} placeholder="300" /></div>
                <div className="space-y-1"><Label className="text-xs">Daily repay</Label><Input type="number" value={form.daily_repayment} onChange={(e) => setForm(f => ({ ...f, daily_repayment: e.target.value }))} placeholder="50" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Start date</Label><Input type="date" value={form.loan_start_date} onChange={(e) => setForm(f => ({ ...f, loan_start_date: e.target.value }))} /></div>
            </section>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus size={16} className="mr-1" /> {createMutation.isPending ? "Adding..." : "Add Borrower"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
