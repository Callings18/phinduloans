import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { useHouseBorrowers, useHouseLoans } from "@/hooks/useHouseData";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { getEdgeFunctionErrorMessage } from "@phinduloans/shared/utils/getEdgeFunctionErrorMessage";
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
  const normalizedProductCode = productCode.trim().toUpperCase();
  const { data: borrowers, isLoading } = useHouseBorrowers(normalizedProductCode);
  const { data: loans } = useHouseLoans(normalizedProductCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManageBorrowers = can("house", "borrowers_manage");

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", nrc_number: "", address: "", city: "Lusaka",
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
    queryKey: ["house-product-id", normalizedProductCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name")
        .eq("product_code", normalizedProductCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(normalizedProductCode),
  });

  const isMarketeer = normalizedProductCode === "MARKETEER";

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!canManageBorrowers) throw new Error("You do not have permission to add borrowers.");
      if (!form.full_name.trim()) throw new Error("Full name is required.");
      if (isMarketeer) {
        if (!form.phone.trim()) throw new Error("Phone number is required for Marketeer borrowers.");
      } else {
        if (!form.email.trim()) throw new Error("Email is required.");
      }
      const response = await supabase.functions.invoke("create-borrower", {
        body: {
          email: form.email.trim() || null,
          full_name: form.full_name,
          phone: form.phone || null,
          nrc_number: form.nrc_number || null,
          address: form.address || null,
          city: form.city || null,
          product_code: normalizedProductCode,
        },
      });
      if (response.error) {
        throw new Error(await getEdgeFunctionErrorMessage(response.error, "Borrower creation failed."));
      }
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["house-borrowers", normalizedProductCode] });
      queryClient.invalidateQueries({ queryKey: ["product-loan-borrowers", normalizedProductCode] });
      queryClient.invalidateQueries({ queryKey: ["admin-borrowers"] });
      toast({ title: data?.existing ? "Borrower already existed" : "Borrower added", description: data?.message || "Use the Loans tab to create a loan for this borrower." });
      setIsAddOpen(false);
      setForm({ full_name: "", email: "", phone: "", nrc_number: "", address: "", city: "Lusaka" });
    },
    onError: (e: any) => {
      toast({ title: "Error creating borrower", description: e.message, variant: "destructive" });
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
        {canManageBorrowers && (
          <Button onClick={() => setIsAddOpen(true)} size="sm">
            <Plus size={16} className="mr-1" /> Add Borrower
          </Button>
        )}
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
                  <Label>Phone {isMarketeer ? "*" : ""}</Label>
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
                  <Label>Email {isMarketeer ? "" : "*"}</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder={isMarketeer ? "Optional for marketeers" : "john@example.com"} />
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
