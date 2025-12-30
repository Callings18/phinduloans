import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePMIC } from "@/hooks/usePMIC";
import {
  RefreshCw,
  Users,
  FileText,
  Building2,
  AlertTriangle,
  Settings,
  CheckCircle,
  Clock,
} from "lucide-react";
import PMICConfigSettings from "@/components/admin/pmic/PMICConfigSettings";
import PMICEmployerList from "@/components/admin/pmic/PMICEmployerList";
import PMICEnrollmentList from "@/components/admin/pmic/PMICEnrollmentList";
import PMICSubmissionList from "@/components/admin/pmic/PMICSubmissionList";
import PMICExceptionList from "@/components/admin/pmic/PMICExceptionList";

const AdminPMIC = () => {
  const {
    config,
    stats,
    loading,
    refreshAll,
  } = usePMIC();

  const [activeTab, setActiveTab] = useState("enrollments");

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 2,
    }).format(amount).replace('ZMW', 'K');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Payroll Management Integration Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage payroll deductions, employer enrollments, and submissions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={config?.is_active ? "default" : "secondary"}>
              {config?.is_active ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  Not Configured
                </>
              )}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingEnrollments} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deduction Capacity</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalDeductionCapacity)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total monthly capacity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submissions</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingSubmissions}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedSubmissions} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Exceptions</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.openExceptions}</div>
              <p className="text-xs text-muted-foreground">
                {stats.investigatingExceptions} investigating
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="enrollments" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Enrollments</span>
                </TabsTrigger>
                <TabsTrigger value="submissions" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Submissions</span>
                </TabsTrigger>
                <TabsTrigger value="employers" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Employers</span>
                </TabsTrigger>
                <TabsTrigger value="exceptions" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="hidden sm:inline">Exceptions</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="enrollments" className="mt-0">
                <PMICEnrollmentList />
              </TabsContent>

              <TabsContent value="submissions" className="mt-0">
                <PMICSubmissionList />
              </TabsContent>

              <TabsContent value="employers" className="mt-0">
                <PMICEmployerList />
              </TabsContent>

              <TabsContent value="exceptions" className="mt-0">
                <PMICExceptionList />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <PMICConfigSettings />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPMIC;
