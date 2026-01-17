import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  User,
  Briefcase,
  Loader2,
  Calendar,
  FileText,
  Building2,
  CreditCard,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ZAMBIAN_PROVINCES, ZAMBIAN_DEPARTMENTS } from "@/utils/zambianPayrollCalculations";

interface Employee {
  id: string;
  employee_number: string;
  title: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  nrc_number: string;
  date_of_birth: string;
  gender: string | null;
  marital_status: string | null;
  email: string;
  phone: string;
  alternative_phone: string | null;
  address: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  employment_type: string;
  department: string | null;
  position: string;
  job_grade: string | null;
  reporting_manager_id: string | null;
  employment_start_date: string;
  employment_end_date: string | null;
  probation_end_date: string | null;
  is_active: boolean;
  napsa_number: string | null;
  tax_pin: string | null;
  nhima_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  mobile_money_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

const AdminHR = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  const [formData, setFormData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    nrc_number: "",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    email: "",
    phone: "",
    alternative_phone: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    employment_type: "permanent",
    department: "",
    position: "",
    job_grade: "",
    reporting_manager_id: "",
    employment_start_date: "",
    employment_end_date: "",
    probation_end_date: "",
    is_active: true,
    napsa_number: "",
    tax_pin: "",
    nhima_number: "",
    bank_name: "",
    bank_account_number: "",
    bank_branch: "",
    mobile_money_number: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
  });

  // Fetch employees
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch managers for reporting manager dropdown
  const { data: managers } = useQuery({
    queryKey: ["employee-managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate employee number - get last number and increment
      const { data: lastEmp } = await supabase
        .from("employees")
        .select("employee_number")
        .like("employee_number", "PHINDU-%")
        .order("employee_number", { ascending: false })
        .limit(1)
        .single();
      
      let empNum = "PHINDU-0001";
      if (lastEmp?.employee_number) {
        const lastNum = parseInt(lastEmp.employee_number.replace("PHINDU-", ""));
        empNum = `PHINDU-${String(lastNum + 1).padStart(4, "0")}`;
      }

      const { error } = await supabase.from("employees").insert({
        employee_number: empNum,
        title: data.title || null,
        first_name: data.first_name,
        last_name: data.last_name,
        middle_name: data.middle_name || null,
        nrc_number: data.nrc_number,
        date_of_birth: data.date_of_birth,
        gender: data.gender || null,
        marital_status: data.marital_status || null,
        email: data.email,
        phone: data.phone,
        alternative_phone: data.alternative_phone || null,
        address: data.address,
        city: data.city,
        province: data.province || null,
        postal_code: data.postal_code || null,
        employment_type: data.employment_type,
        department: data.department || null,
        position: data.position,
        job_grade: data.job_grade || null,
        reporting_manager_id: data.reporting_manager_id || null,
        employment_start_date: data.employment_start_date,
        employment_end_date: data.employment_end_date || null,
        probation_end_date: data.probation_end_date || null,
        is_active: data.is_active,
        napsa_number: data.napsa_number || null,
        tax_pin: data.tax_pin || null,
        nhima_number: data.nhima_number || null,
        bank_name: data.bank_name || null,
        bank_account_number: data.bank_account_number || null,
        bank_branch: data.bank_branch || null,
        mobile_money_number: data.mobile_money_number || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_relationship: data.emergency_contact_relationship || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        created_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("employees")
        .update({
          title: data.title || null,
          first_name: data.first_name,
          last_name: data.last_name,
          middle_name: data.middle_name || null,
          nrc_number: data.nrc_number,
          date_of_birth: data.date_of_birth,
          gender: data.gender || null,
          marital_status: data.marital_status || null,
          email: data.email,
          phone: data.phone,
          alternative_phone: data.alternative_phone || null,
          address: data.address,
          city: data.city,
          province: data.province || null,
          postal_code: data.postal_code || null,
          employment_type: data.employment_type,
          department: data.department || null,
          position: data.position,
          job_grade: data.job_grade || null,
          reporting_manager_id: data.reporting_manager_id || null,
          employment_start_date: data.employment_start_date,
          employment_end_date: data.employment_end_date || null,
          probation_end_date: data.probation_end_date || null,
          is_active: data.is_active,
          napsa_number: data.napsa_number || null,
          tax_pin: data.tax_pin || null,
          nhima_number: data.nhima_number || null,
          bank_name: data.bank_name || null,
          bank_account_number: data.bank_account_number || null,
          bank_branch: data.bank_branch || null,
          mobile_money_number: data.mobile_money_number || null,
          emergency_contact_name: data.emergency_contact_name || null,
          emergency_contact_relationship: data.emergency_contact_relationship || null,
          emergency_contact_phone: data.emergency_contact_phone || null,
          updated_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("employees")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Success",
        description: "Employee deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate employee",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      nrc_number: "",
      date_of_birth: "",
      gender: "",
      marital_status: "",
      email: "",
      phone: "",
      alternative_phone: "",
      address: "",
      city: "",
      province: "",
      postal_code: "",
      employment_type: "permanent",
      department: "",
      position: "",
      job_grade: "",
      reporting_manager_id: "",
      employment_start_date: "",
      employment_end_date: "",
      probation_end_date: "",
      is_active: true,
      napsa_number: "",
      tax_pin: "",
      nhima_number: "",
      bank_name: "",
      bank_account_number: "",
      bank_branch: "",
      mobile_money_number: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
    });
    setEditingEmployee(null);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      title: employee.title || "",
      first_name: employee.first_name,
      last_name: employee.last_name,
      middle_name: employee.middle_name || "",
      nrc_number: employee.nrc_number,
      date_of_birth: employee.date_of_birth,
      gender: employee.gender || "",
      marital_status: employee.marital_status || "",
      email: employee.email,
      phone: employee.phone,
      alternative_phone: employee.alternative_phone || "",
      address: employee.address,
      city: employee.city,
      province: employee.province || "",
      postal_code: employee.postal_code || "",
      employment_type: employee.employment_type,
      department: employee.department || "",
      position: employee.position,
      job_grade: employee.job_grade || "",
      reporting_manager_id: employee.reporting_manager_id || "",
      employment_start_date: employee.employment_start_date,
      employment_end_date: employee.employment_end_date || "",
      probation_end_date: employee.probation_end_date || "",
      is_active: employee.is_active,
      napsa_number: employee.napsa_number || "",
      tax_pin: employee.tax_pin || "",
      nhima_number: employee.nhima_number || "",
      bank_name: employee.bank_name || "",
      bank_account_number: employee.bank_account_number || "",
      bank_branch: employee.bank_branch || "",
      mobile_money_number: employee.mobile_money_number || "",
      emergency_contact_name: employee.emergency_contact_name || "",
      emergency_contact_relationship: employee.emergency_contact_relationship || "",
      emergency_contact_phone: employee.emergency_contact_phone || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast({
        title: "Validation Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredEmployees = employees?.filter((emp) => {
    const search = searchTerm.toLowerCase();
    return (
      emp.first_name.toLowerCase().includes(search) ||
      emp.last_name.toLowerCase().includes(search) ||
      emp.employee_number.toLowerCase().includes(search) ||
      emp.nrc_number.toLowerCase().includes(search) ||
      emp.email.toLowerCase().includes(search) ||
      emp.position.toLowerCase().includes(search) ||
      emp.department?.toLowerCase().includes(search)
    );
  });

  const activeEmployees = filteredEmployees?.filter((e) => e.is_active) || [];
  const inactiveEmployees = filteredEmployees?.filter((e) => !e.is_active) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Human Resources</h1>
            <p className="text-muted-foreground mt-1">
              Manage internal employees and staff records
            </p>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-button">
                <Plus size={18} className="mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? "Edit Employee" : "Add New Employee"}
                </DialogTitle>
                <DialogDescription>
                  {editingEmployee
                    ? "Update employee information"
                    : "Enter employee details to add them to the system"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="personal" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                    <TabsTrigger value="employment">Employment</TabsTrigger>
                    <TabsTrigger value="tax">Tax & Banking</TabsTrigger>
                    <TabsTrigger value="emergency">Emergency</TabsTrigger>
                  </TabsList>

                  {/* Personal Information Tab */}
                  <TabsContent value="personal" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Select
                          value={formData.title}
                          onValueChange={(value) =>
                            setFormData({ ...formData, title: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mr">Mr</SelectItem>
                            <SelectItem value="Mrs">Mrs</SelectItem>
                            <SelectItem value="Ms">Ms</SelectItem>
                            <SelectItem value="Dr">Dr</SelectItem>
                            <SelectItem value="Prof">Prof</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nrc_number">NRC Number *</Label>
                        <Input
                          id="nrc_number"
                          value={formData.nrc_number}
                          onChange={(e) =>
                            setFormData({ ...formData, nrc_number: e.target.value })
                          }
                          placeholder="XXXXXX/XX/X"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) =>
                            setFormData({ ...formData, first_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middle_name">Middle Name</Label>
                        <Input
                          id="middle_name"
                          value={formData.middle_name}
                          onChange={(e) =>
                            setFormData({ ...formData, middle_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) =>
                            setFormData({ ...formData, last_name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date_of_birth">Date of Birth *</Label>
                        <Input
                          id="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) =>
                            setFormData({ ...formData, date_of_birth: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) =>
                            setFormData({ ...formData, gender: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marital_status">Marital Status</Label>
                        <Select
                          value={formData.marital_status}
                          onValueChange={(value) =>
                            setFormData({ ...formData, marital_status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+260 9XX XXXXXX"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alternative_phone">Alternative Phone</Label>
                      <Input
                        id="alternative_phone"
                        value={formData.alternative_phone}
                        onChange={(e) =>
                          setFormData({ ...formData, alternative_phone: e.target.value })
                        }
                        placeholder="+260 9XX XXXXXX"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="province">Province</Label>
                        <Select
                          value={formData.province}
                          onValueChange={(value) =>
                            setFormData({ ...formData, province: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            {ZAMBIAN_PROVINCES.map((province) => (
                              <SelectItem key={province} value={province}>
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postal_code">Postal Code</Label>
                        <Input
                          id="postal_code"
                          value={formData.postal_code}
                          onChange={(e) =>
                            setFormData({ ...formData, postal_code: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Employment Tab */}
                  <TabsContent value="employment" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employment_type">Employment Type *</Label>
                        <Select
                          value={formData.employment_type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, employment_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permanent">Permanent</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="temporary">Temporary</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) =>
                            setFormData({ ...formData, department: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {ZAMBIAN_DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="position">Position/Job Title *</Label>
                        <Input
                          id="position"
                          value={formData.position}
                          onChange={(e) =>
                            setFormData({ ...formData, position: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job_grade">Job Grade</Label>
                        <Input
                          id="job_grade"
                          value={formData.job_grade}
                          onChange={(e) =>
                            setFormData({ ...formData, job_grade: e.target.value })
                          }
                          placeholder="e.g., A1, B2, C3"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reporting_manager_id">Reporting Manager</Label>
                      <Select
                        value={formData.reporting_manager_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, reporting_manager_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {managers?.map((manager: any) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.first_name} {manager.last_name} - {manager.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employment_start_date">Start Date *</Label>
                        <Input
                          id="employment_start_date"
                          type="date"
                          value={formData.employment_start_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              employment_start_date: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employment_end_date">End Date</Label>
                        <Input
                          id="employment_end_date"
                          type="date"
                          value={formData.employment_end_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              employment_end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="probation_end_date">Probation End Date</Label>
                        <Input
                          id="probation_end_date"
                          type="date"
                          value={formData.probation_end_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              probation_end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tax & Banking Tab */}
                  <TabsContent value="tax" className="space-y-4 mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="napsa_number">NAPSA Number</Label>
                        <Input
                          id="napsa_number"
                          value={formData.napsa_number}
                          onChange={(e) =>
                            setFormData({ ...formData, napsa_number: e.target.value })
                          }
                          placeholder="NAPSA membership number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_pin">Tax PIN (ZRA)</Label>
                        <Input
                          id="tax_pin"
                          value={formData.tax_pin}
                          onChange={(e) =>
                            setFormData({ ...formData, tax_pin: e.target.value })
                          }
                          placeholder="ZRA Tax PIN"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nhima_number">NHIMA Number</Label>
                        <Input
                          id="nhima_number"
                          value={formData.nhima_number}
                          onChange={(e) =>
                            setFormData({ ...formData, nhima_number: e.target.value })
                          }
                          placeholder="NHIMA membership number"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bank_name">Bank Name</Label>
                        <Input
                          id="bank_name"
                          value={formData.bank_name}
                          onChange={(e) =>
                            setFormData({ ...formData, bank_name: e.target.value })
                          }
                          placeholder="e.g., Zanaco, FNB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank_account_number">Account Number</Label>
                        <Input
                          id="bank_account_number"
                          value={formData.bank_account_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bank_account_number: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank_branch">Branch</Label>
                        <Input
                          id="bank_branch"
                          value={formData.bank_branch}
                          onChange={(e) =>
                            setFormData({ ...formData, bank_branch: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mobile_money_number">Mobile Money Number</Label>
                      <Input
                        id="mobile_money_number"
                        value={formData.mobile_money_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mobile_money_number: e.target.value,
                          })
                        }
                        placeholder="+260 9XX XXXXXX"
                      />
                    </div>
                  </TabsContent>

                  {/* Emergency Contact Tab */}
                  <TabsContent value="emergency" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_name">Contact Name</Label>
                        <Input
                          id="emergency_contact_name"
                          value={formData.emergency_contact_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergency_contact_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                        <Input
                          id="emergency_contact_relationship"
                          value={formData.emergency_contact_relationship}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergency_contact_relationship: e.target.value,
                            })
                          }
                          placeholder="e.g., Spouse, Parent, Sibling"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                      <Input
                        id="emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergency_contact_phone: e.target.value,
                          })
                        }
                        placeholder="+260 9XX XXXXXX"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingEmployee ? "Update" : "Create"} Employee
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name, employee number, NRC, email, position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{employees?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="text-success" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeEmployees.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <XCircle className="text-warning" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inactiveEmployees.length}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredEmployees?.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No employees found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search" : "Add your first employee to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Employee Records</CardTitle>
              <CardDescription>Manage employee information and records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee #</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="text-primary" size={18} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {employee.title} {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {employee.employee_number}
                        </Badge>
                      </TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.department || "N/A"}</TableCell>
                      <TableCell>
                        {format(new Date(employee.employment_start_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            employee.is_active
                              ? "bg-success/20 text-success border-success/30"
                              : "bg-warning/20 text-warning border-warning/30"
                          }
                        >
                          {employee.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingEmployee(employee)}>
                              <Eye size={14} className="mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(employee)}>
                              <Edit size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to deactivate this employee?"
                                  )
                                ) {
                                  deleteMutation.mutate(employee.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 size={14} className="mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Employee Details Dialog */}
      <Dialog open={!!viewingEmployee} onOpenChange={() => setViewingEmployee(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {viewingEmployee.title} {viewingEmployee.first_name}{" "}
                  {viewingEmployee.last_name}
                </DialogTitle>
                <DialogDescription>
                  Employee Number: {viewingEmployee.employee_number}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">NRC Number</Label>
                    <p className="font-medium">{viewingEmployee.nrc_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {format(new Date(viewingEmployee.date_of_birth), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{viewingEmployee.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{viewingEmployee.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Position</Label>
                    <p className="font-medium">{viewingEmployee.position}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium">{viewingEmployee.department || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">NAPSA Number</Label>
                    <p className="font-medium">{viewingEmployee.napsa_number || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tax PIN</Label>
                    <p className="font-medium">{viewingEmployee.tax_pin || "N/A"}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminHR;
