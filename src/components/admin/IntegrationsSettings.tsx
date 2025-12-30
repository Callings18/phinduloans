import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, FileText, Settings, CheckCircle, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface IntegrationSettings {
  crb_enabled: boolean;
  crb_provider: string;
  crb_auto_decline_score: number;
  crb_manual_review_score: number;
  crb_auto_approve_score: number;
  guarantee_enabled: boolean;
  guarantee_provider: string;
  guarantee_default_percentage: number;
  guarantee_fee_percentage: number;
}

const defaultSettings: IntegrationSettings = {
  crb_enabled: false,
  crb_provider: "creditbridge",
  crb_auto_decline_score: 250,
  crb_manual_review_score: 400,
  crb_auto_approve_score: 600,
  guarantee_enabled: false,
  guarantee_provider: "pmic",
  guarantee_default_percentage: 80,
  guarantee_fee_percentage: 2,
};

export const IntegrationsSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<IntegrationSettings>(defaultSettings);
  const [crbApiConfigured, setCrbApiConfigured] = useState(false);
  const [guaranteeApiConfigured, setGuaranteeApiConfigured] = useState(false);

  // Fetch existing settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["integration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "integrations")
        .maybeSingle();

      if (error) throw error;
      if (!data?.value) return null;
      return data.value as unknown as IntegrationSettings;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
  }, [savedSettings]);

  const saveSettings = useMutation({
    mutationFn: async (newSettings: IntegrationSettings) => {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "integrations")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ 
            value: JSON.parse(JSON.stringify(newSettings)), 
            updated_at: new Date().toISOString() 
          })
          .eq("key", "integrations");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert([{ 
            key: "integrations", 
            value: JSON.parse(JSON.stringify(newSettings)),
            description: "CRB and Credit Guarantee integration settings"
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
      toast({
        title: "Settings Saved",
        description: "Integration settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettings.mutate(settings);
  };

  const testCrbConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("crb-check", {
        body: {
          borrower_id: "test",
          loan_application_id: "test",
          nrc_number: "000000/00/0",
          full_name: "Test User",
          consent_obtained: true,
        },
      });
      
      if (error) throw error;
      
      setCrbApiConfigured(true);
      toast({
        title: "CRB Connection Test",
        description: data.credit_score 
          ? `Connected successfully. Test score: ${data.credit_score}` 
          : "Connected (using mock response - API keys not configured)",
      });
    } catch (error: any) {
      setCrbApiConfigured(false);
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testGuaranteeConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("guarantee-check", {
        body: {
          loan_id: "test",
          borrower_id: "test",
          loan_amount: 10000,
          loan_term_months: 12,
          borrower_nrc: "000000/00/0",
          borrower_name: "Test User",
          guarantee_provider: settings.guarantee_provider,
        },
      });
      
      if (error) throw error;
      
      setGuaranteeApiConfigured(true);
      toast({
        title: "Guarantee Connection Test",
        description: data.reference_code 
          ? `Connected successfully. Test ref: ${data.reference_code}` 
          : "Connected (using mock response - API keys not configured)",
      });
    } catch (error: any) {
      setGuaranteeApiConfigured(false);
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CRB Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Credit Reference Bureau (CRB)
          </CardTitle>
          <CardDescription>
            Configure credit bureau integration for borrower credit checks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable CRB Checks</Label>
              <p className="text-sm text-muted-foreground">
                Allow CRB credit checks during loan evaluation
              </p>
            </div>
            <Switch
              checked={settings.crb_enabled}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, crb_enabled: checked })
              }
            />
          </div>

          {settings.crb_enabled && (
            <>
              <Separator />
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>CRB Provider</Label>
                  <Select
                    value={settings.crb_provider}
                    onValueChange={(value) => 
                      setSettings({ ...settings, crb_provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="creditbridge">CreditBridge</SelectItem>
                      <SelectItem value="transunion">TransUnion</SelectItem>
                      <SelectItem value="experian">Experian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={testCrbConnection}>
                    <Settings className="h-4 w-4 mr-2" />
                    Test Connection
                  </Button>
                  {crbApiConfigured && (
                    <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                  )}
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-3">Credit Score Thresholds</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-destructive">Auto-Decline Below</Label>
                    <Input
                      type="number"
                      value={settings.crb_auto_decline_score}
                      onChange={(e) => 
                        setSettings({ 
                          ...settings, 
                          crb_auto_decline_score: parseInt(e.target.value) || 0 
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-yellow-600">Manual Review Below</Label>
                    <Input
                      type="number"
                      value={settings.crb_manual_review_score}
                      onChange={(e) => 
                        setSettings({ 
                          ...settings, 
                          crb_manual_review_score: parseInt(e.target.value) || 0 
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-green-600">Auto-Approve Above</Label>
                    <Input
                      type="number"
                      value={settings.crb_auto_approve_score}
                      onChange={(e) => 
                        setSettings({ 
                          ...settings, 
                          crb_auto_approve_score: parseInt(e.target.value) || 0 
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  API credentials (CRB_API_URL, CRB_API_KEY) must be configured in environment secrets 
                  for live CRB checks. Without credentials, mock responses will be used for testing.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Guarantee Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Credit Guarantee Scheme
          </CardTitle>
          <CardDescription>
            Configure PMIC/ZCGS credit guarantee integration for loan coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Guarantee Module</Label>
              <p className="text-sm text-muted-foreground">
                Allow credit guarantee checks for eligible loan products
              </p>
            </div>
            <Switch
              checked={settings.guarantee_enabled}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, guarantee_enabled: checked })
              }
            />
          </div>

          {settings.guarantee_enabled && (
            <>
              <Separator />
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Guarantee Provider</Label>
                  <Select
                    value={settings.guarantee_provider}
                    onValueChange={(value) => 
                      setSettings({ ...settings, guarantee_provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pmic">PMIC</SelectItem>
                      <SelectItem value="zcgs">ZCGS (Zambia Credit Guarantee Scheme)</SelectItem>
                      <SelectItem value="other">Other Provider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={testGuaranteeConnection}>
                    <Settings className="h-4 w-4 mr-2" />
                    Test Connection
                  </Button>
                  {guaranteeApiConfigured && (
                    <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Guarantee Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.guarantee_default_percentage}
                      onChange={(e) => 
                        setSettings({ 
                          ...settings, 
                          guarantee_default_percentage: parseInt(e.target.value) || 80 
                        })
                      }
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Guarantee Fee Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={settings.guarantee_fee_percentage}
                      onChange={(e) => 
                        setSettings({ 
                          ...settings, 
                          guarantee_fee_percentage: parseFloat(e.target.value) || 2 
                        })
                      }
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  API credentials (PMIC_API_URL, PMIC_API_KEY) must be configured in environment secrets 
                  for live guarantee checks. Manual reference entry is available as a fallback.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Integration Settings
        </Button>
      </div>
    </div>
  );
};
