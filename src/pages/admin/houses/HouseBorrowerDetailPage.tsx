import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseBorrowers, useHouseLoans } from "@/hooks/useHouseData";
import { format } from "date-fns";
import { ArrowLeft, User, Phone, IdCard, MapPin, CreditCard, Eye, Mail } from "lucide-react";
import BorrowerKYCSection from "@/components/admin/BorrowerKYCSection";

export default function HouseBorrowerDetailPage() {
  const { productCode = "", borrowerId = "" } = useParams<{ productCode: string; borrowerId: string }>();
  const { data: borrowers } = useHouseBorrowers(productCode);
  const { data: loans } = useHouseLoans(productCode);

  const borrower = useMemo(() => (borrowers ?? []).find((b: any) => b.id === borrowerId), [borrowers, borrowerId]);
  const borrowerLoans = useMemo(() => (loans ?? []).filter((l: any) => l.user_id === borrowerId), [loans, borrowerId]);

  // Fetch KYC info
  const { data: kyc } = useQuery({
    queryKey: ["borrower-kyc", borrowerId],
    enabled: Boolean(borrowerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_kyc_info")
        .select("*")
        .eq("borrower_id", borrowerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch repayment stats for this borrower's loans
  const loanIds = borrowerLoans.map((l: any) => l.id);
  const { data: repayments = [] } = useQuery({
    queryKey: ["borrower-house-repayments", loanIds],
    enabled: loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, loan_id, amount, status, principal_paid")
        .in("loan_id", loanIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalBorrowed = borrowerLoans.reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0);
  const totalPaid = repayments.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0);
  const activeLoans = borrowerLoans.filter((l: any) => ["active", "disbursed"].includes(l.status));

  if (!borrower) return <p className="text-sm text-muted-foreground p-4">Borrower not found.</p>;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to={`/admin/houses/${productCode}/borrowers`}>
          <ArrowLeft size={14} className="mr-1" /> Back to borrowers
        </Link>
      </Button>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
              <User className="text-primary-foreground" size={20} />
            </div>
            {borrower.full_name || "Unknown"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-2">
            <Mail size={14} className="mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{borrower.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone size={14} className="mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{borrower.phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <IdCard size={14} className="mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">NRC</p>
              <p className="text-sm font-medium">{borrower.nrc_number || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={14} className="mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">City</p>
              <p className="text-sm font-medium">{borrower.city || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC financial info */}
      {kyc && (
        <Card>
          <CardHeader><CardTitle className="text-base">Financial Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {kyc.bank_name && <div><p className="text-xs text-muted-foreground">Bank</p><p className="font-medium">{kyc.bank_name}</p></div>}
            {kyc.bank_account_number && <div><p className="text-xs text-muted-foreground">Account #</p><p className="font-medium">{kyc.bank_account_number}</p></div>}
            {kyc.mtn_mobile_money_number && <div><p className="text-xs text-muted-foreground">MTN MoMo</p><p className="font-medium">{kyc.mtn_mobile_money_number}</p></div>}
            {kyc.airtel_money_number && <div><p className="text-xs text-muted-foreground">Airtel Money</p><p className="font-medium">{kyc.airtel_money_number}</p></div>}
            {kyc.nok_full_name && <div><p className="text-xs text-muted-foreground">Next of Kin</p><p className="font-medium">{kyc.nok_full_name} ({kyc.nok_relationship})</p></div>}
            {kyc.nok_phone && <div><p className="text-xs text-muted-foreground">NOK Phone</p><p className="font-medium">{kyc.nok_phone}</p></div>}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{borrowerLoans.length}</p><p className="text-xs text-muted-foreground">Total Loans</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{activeLoans.length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">K{totalBorrowed.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Borrowed</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">K{totalPaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Paid</p></CardContent></Card>
      </div>

      {/* Loans */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard size={16} /> Loan History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {borrowerLoans.map((loan: any) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">K{Number(loan.loan_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{loan.loan_term_months} {loan.term_unit || "months"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={loan.status === "active" ? "default" : loan.status === "completed" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {loan.status?.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {loan.created_at ? format(new Date(loan.created_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/admin/houses/${productCode}/loans/${loan.id}`}><Eye size={14} /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {borrowerLoans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No loans in this house.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
