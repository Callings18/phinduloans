import { useEffect, useState } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Switch } from "@phinduloans/shared/components/ui/switch";
import { Slider } from "@phinduloans/shared/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { usePMIC } from "@/hooks/usePMIC";
import { Calendar } from "@phinduloans/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@phinduloans/shared/components/ui/popover";
import { CalendarIcon, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@phinduloans/shared/lib/utils";

const PMICConfigSettings = () => {
  const { config, fetchConfig, updateConfig } = usePMIC();
  const [formData, setFormData] = useState({
    payroll_authority: '',
    deduction_code: '',
    deduction_code_assigned_date: null as Date | null,
    max_deduction_percent: 33,
    min_net_pay_percent: 50,
    max_loan_multiplier: 36,
    default_loan_term_months: 24,
    max_concurrent_loans: 3,
    is_active: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        payroll_authority: config.payroll_authority || '',
        deduction_code: config.deduction_code || '',
        deduction_code_assigned_date: config.deduction_code_assigned_date 
          ? new Date(config.deduction_code_assigned_date) 
          : null,
        max_deduction_percent: config.max_deduction_percent || 33,
        min_net_pay_percent: config.min_net_pay_percent || 50,
        max_loan_multiplier: config.max_loan_multiplier || 36,
        default_loan_term_months: config.default_loan_term_months || 24,
        max_concurrent_loans: config.max_concurrent_loans || 3,
        is_active: config.is_active || false,
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    await updateConfig({
      ...formData,
      deduction_code_assigned_date: formData.deduction_code_assigned_date?.toISOString().split('T')[0] || null,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Payroll Authority Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Authority</CardTitle>
          <CardDescription>
            Configure your payroll integration authority and deduction code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payroll Authority</Label>
              <Select
                value={formData.payroll_authority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, payroll_authority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select authority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PMEC">PMEC (Public Service)</SelectItem>
                  <SelectItem value="PSPF">PSPF (Pension Fund)</SelectItem>
                  <SelectItem value="NAPSA">NAPSA</SelectItem>
                  <SelectItem value="PRIVATE">Private Sector</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Deduction Code</Label>
              <Input
                placeholder="e.g., MFI-123"
                value={formData.deduction_code}
                onChange={(e) => setFormData(prev => ({ ...prev, deduction_code: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Code Assigned Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.deduction_code_assigned_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deduction_code_assigned_date 
                      ? format(formData.deduction_code_assigned_date, "PPP") 
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.deduction_code_assigned_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, deduction_code_assigned_date: date || null }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Enable PMIC Integration</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deduction Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Deduction Rules</CardTitle>
          <CardDescription>
            Configure salary deduction limits and loan eligibility rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Maximum Deduction Percentage</Label>
                <span className="text-sm font-medium">{formData.max_deduction_percent}%</span>
              </div>
              <Slider
                value={[formData.max_deduction_percent]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, max_deduction_percent: value }))}
                min={10}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Maximum percentage of net salary that can be deducted
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Net Pay Percentage</Label>
                <span className="text-sm font-medium">{formData.min_net_pay_percent}%</span>
              </div>
              <Slider
                value={[formData.min_net_pay_percent]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, min_net_pay_percent: value }))}
                min={40}
                max={70}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Employee must retain this percentage of net salary after deductions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max Loan Multiplier</Label>
              <Input
                type="number"
                value={formData.max_loan_multiplier}
                onChange={(e) => setFormData(prev => ({ ...prev, max_loan_multiplier: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Max loan = salary × multiplier
              </p>
            </div>

            <div className="space-y-2">
              <Label>Default Loan Term (months)</Label>
              <Input
                type="number"
                value={formData.default_loan_term_months}
                onChange={(e) => setFormData(prev => ({ ...prev, default_loan_term_months: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Concurrent Loans</Label>
              <Input
                type="number"
                value={formData.max_concurrent_loans}
                onChange={(e) => setFormData(prev => ({ ...prev, max_concurrent_loans: Number(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default PMICConfigSettings;
