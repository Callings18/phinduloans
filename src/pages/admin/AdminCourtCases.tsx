import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Gavel,
  Search,
  AlertTriangle,
  FileText,
  DollarSign,
  Loader2,
  Construction,
} from "lucide-react";

const AdminCourtCases = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch defaulted loans that could become court cases
  const { data: defaultedLoans, isLoading } = useQuery({
    queryKey: ["defaulted-loans-for-court"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          id,
          user_id,
          loan_amount,
          total_repayment,
          full_name,
          email,
          phone,
          created_at
        `)
        .eq("status", "defaulted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredLoans = defaultedLoans?.filter((loan) => {
    const matchesSearch =
      loan.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    totalDefaulted: defaultedLoans?.length || 0,
    totalAmount: defaultedLoans?.reduce((sum, l) => sum + Number(l.loan_amount || 0), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Gavel className="text-primary" size={32} />
            Court Cases
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage legal proceedings for defaulted loans
          </p>
        </div>

        {/* Coming Soon Notice */}
        <Card className="glass border-warning/30 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Construction className="text-warning mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Court Case Management Coming Soon</h3>
                <p className="text-muted-foreground text-sm">
                  Full court case management with case tracking, hearing schedules, judgments, and enforcement 
                  tracking will be available in a future update. For now, you can view defaulted loans below 
                  that may require legal action.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Defaulted Loans</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalDefaulted}</p>
                </div>
                <AlertTriangle className="text-destructive" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total at Risk</p>
                  <p className="text-2xl font-bold text-foreground">K{stats.totalAmount.toLocaleString()}</p>
                </div>
                <DollarSign className="text-warning" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by borrower name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Defaulted Loans Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLoans && filteredLoans.length > 0 ? (
          <Card className="glass border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>Total Owed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{loan.full_name}</p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{loan.email}</p>
                        <p className="text-sm text-muted-foreground">{loan.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">K{Number(loan.loan_amount).toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-destructive">
                        K{Number(loan.total_repayment || loan.loan_amount).toLocaleString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Defaulted</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No defaulted loans found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCourtCases;
