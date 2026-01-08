import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Search,
  Construction,
  User,
  Loader2,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

const AdminWallets = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch profiles with their loan summary as "wallet" data
  const { data: userSummaries, isLoading } = useQuery({
    queryKey: ["user-wallet-summaries"],
    queryFn: async () => {
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Get loan data for aggregation
      const { data: loans, error: loansError } = await supabase
        .from("loan_applications")
        .select("user_id, loan_amount, total_repayment, status");

      if (loansError) throw loansError;

      // Get repayment data
      const { data: repayments, error: repaymentsError } = await supabase
        .from("loan_repayments")
        .select("user_id, amount, status");

      if (repaymentsError) throw repaymentsError;

      // Aggregate data per user
      return profiles?.map(profile => {
        const userLoans = loans?.filter(l => l.user_id === profile.id) || [];
        const userRepayments = repayments?.filter(r => r.user_id === profile.id) || [];
        
        const totalReceived = userLoans
          .filter(l => ["active", "disbursed", "completed"].includes(l.status))
          .reduce((sum, l) => sum + Number(l.loan_amount || 0), 0);
        
        const totalOwed = userLoans
          .filter(l => ["active", "disbursed"].includes(l.status))
          .reduce((sum, l) => sum + Number(l.total_repayment || 0), 0);
        
        const totalPaid = userRepayments
          .filter(r => r.status === "paid")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);
        
        const outstandingBalance = totalOwed - totalPaid;
        
        return {
          ...profile,
          total_received: totalReceived,
          total_paid: totalPaid,
          outstanding_balance: outstandingBalance > 0 ? outstandingBalance : 0,
          active_loans: userLoans.filter(l => ["active", "disbursed"].includes(l.status)).length,
        };
      }).filter(u => u.total_received > 0 || u.total_paid > 0) || [];
    },
  });

  const filteredUsers = userSummaries?.filter((user) =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalUsers: filteredUsers?.length || 0,
    totalOutstanding: filteredUsers?.reduce((sum, u) => sum + u.outstanding_balance, 0) || 0,
    totalPaid: filteredUsers?.reduce((sum, u) => sum + u.total_paid, 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Wallet className="text-primary" size={32} />
            Wallet Management
          </h1>
          <p className="text-muted-foreground mt-2">
            View borrower payment summaries and outstanding balances
          </p>
        </div>

        {/* Coming Soon Notice */}
        <Card className="glass border-warning/30 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Construction className="text-warning mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Digital Wallet Feature Coming Soon</h3>
                <p className="text-muted-foreground text-sm">
                  Full wallet functionality with deposits, withdrawals, and balance management will be available 
                  in a future update. Currently showing borrower payment summaries based on loan activity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Borrowers</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                </div>
                <User className="text-primary" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold text-destructive">K{stats.totalOutstanding.toLocaleString()}</p>
                </div>
                <DollarSign className="text-destructive" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Collected</p>
                  <p className="text-2xl font-bold text-success">K{stats.totalPaid.toLocaleString()}</p>
                </div>
                <DollarSign className="text-success" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <Card className="glass border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Total Received</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Active Loans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <User size={18} className="text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">{user.full_name || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">K{user.total_received.toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-success font-semibold">K{user.total_paid.toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <p className={`font-semibold ${user.outstanding_balance > 0 ? "text-destructive" : "text-success"}`}>
                        K{user.outstanding_balance.toLocaleString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.active_loans} active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="text-center py-12">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No borrower data found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminWallets;
