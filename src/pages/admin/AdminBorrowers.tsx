import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, User, Mail, Phone, Calendar, CreditCard, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminBorrowers = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: borrowers, isLoading } = useQuery({
    queryKey: ['admin-borrowers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: loanCounts } = useQuery({
    queryKey: ['borrower-loan-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_applications')
        .select('user_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(loan => {
        counts[loan.user_id] = (counts[loan.user_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filteredBorrowers = borrowers?.filter(borrower =>
    borrower.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Borrowers</h1>
          <p className="text-muted-foreground mt-1">Manage your borrower profiles</p>
        </div>

        {/* Search */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Borrowers Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBorrowers && filteredBorrowers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBorrowers.map((borrower) => (
              <Card key={borrower.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                      <User className="text-primary-foreground" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">
                        {borrower.full_name || 'Unknown'}
                      </h4>
                      <p className="text-muted-foreground text-sm truncate">{borrower.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    {borrower.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} />
                        <span>{borrower.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} />
                      <span>Joined {new Date(borrower.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard size={14} />
                      <span>{loanCounts?.[borrower.id] || 0} loan(s)</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <Eye size={14} className="mr-2" />
                    View Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No borrowers found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBorrowers;
