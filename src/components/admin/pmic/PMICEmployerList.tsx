import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePMIC, PMICEmployer } from "@/hooks/usePMIC";
import { Plus, Search, MoreHorizontal, CheckCircle, Trash2, Edit, Building2 } from "lucide-react";

const PMICEmployerList = () => {
  const { employers, fetchEmployers, addEmployer, updateEmployer, deleteEmployer, verifyEmployer } = usePMIC();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployer, setEditingEmployer] = useState<PMICEmployer | null>(null);
  const [formData, setFormData] = useState({
    employer_code: '',
    employer_name: '',
    employer_type: 'government' as PMICEmployer['employer_type'],
    payroll_cycle: 'monthly' as PMICEmployer['payroll_cycle'],
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
  });

  useEffect(() => {
    fetchEmployers();
  }, [fetchEmployers]);

  const filteredEmployers = employers.filter(e =>
    e.employer_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employer_code.toLowerCase().includes(search.toLowerCase()) ||
    e.contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (employer?: PMICEmployer) => {
    if (employer) {
      setEditingEmployer(employer);
      setFormData({
        employer_code: employer.employer_code,
        employer_name: employer.employer_name,
        employer_type: employer.employer_type,
        payroll_cycle: employer.payroll_cycle,
        contact_name: employer.contact_name || '',
        contact_email: employer.contact_email || '',
        contact_phone: employer.contact_phone || '',
        address: employer.address || '',
      });
    } else {
      setEditingEmployer(null);
      setFormData({
        employer_code: '',
        employer_name: '',
        employer_type: 'government',
        payroll_cycle: 'monthly',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingEmployer) {
      await updateEmployer(editingEmployer.id, formData);
    } else {
      await addEmployer(formData);
    }
    setDialogOpen(false);
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      government: 'bg-blue-100 text-blue-800',
      parastatal: 'bg-purple-100 text-purple-800',
      private: 'bg-gray-100 text-gray-800',
      ngo: 'bg-green-100 text-green-800',
    };
    return <Badge className={colors[type] || 'bg-gray-100'}>{type}</Badge>;
  };

  const getCycleBadge = (cycle: string) => {
    return <Badge variant="outline">{cycle}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employer
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employer</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Payroll Cycle</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No employers found
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployers.map((employer) => (
                <TableRow key={employer.id}>
                  <TableCell className="font-medium">{employer.employer_name}</TableCell>
                  <TableCell>{employer.employer_code}</TableCell>
                  <TableCell>{getTypeBadge(employer.employer_type)}</TableCell>
                  <TableCell>{getCycleBadge(employer.payroll_cycle)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{employer.contact_name}</div>
                      <div className="text-muted-foreground">{employer.contact_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {employer.is_verified ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(employer)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!employer.is_verified && (
                          <DropdownMenuItem onClick={() => verifyEmployer(employer.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => deleteEmployer(employer.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployer ? 'Edit Employer' : 'Add Employer'}</DialogTitle>
            <DialogDescription>
              {editingEmployer ? 'Update employer details' : 'Register a new employer for payroll deductions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employer Code</Label>
                <Input
                  value={formData.employer_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, employer_code: e.target.value }))}
                  placeholder="e.g., GOV-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.employer_type}
                  onValueChange={(value: PMICEmployer['employer_type']) => 
                    setFormData(prev => ({ ...prev, employer_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="parastatal">Parastatal</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="ngo">NGO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Employer Name</Label>
              <Input
                value={formData.employer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, employer_name: e.target.value }))}
                placeholder="Full employer name"
              />
            </div>

            <div className="space-y-2">
              <Label>Payroll Cycle</Label>
              <Select
                value={formData.payroll_cycle}
                onValueChange={(value: PMICEmployer['payroll_cycle']) => 
                  setFormData(prev => ({ ...prev, payroll_cycle: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingEmployer ? 'Update' : 'Add'} Employer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PMICEmployerList;
