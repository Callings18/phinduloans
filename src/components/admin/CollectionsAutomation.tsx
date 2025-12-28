import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { smsService } from "@/utils/smsService";
import {
  Bot,
  MessageSquare,
  Clock,
  ArrowUpCircle,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Settings,
  Zap,
  Bell,
} from "lucide-react";
import { differenceInDays, format, isToday, isTomorrow } from "date-fns";

interface CollectionsAutomationProps {
  overdueRepayments: any[];
  ptpItems: any[];
}

export default function CollectionsAutomation({ overdueRepayments, ptpItems }: CollectionsAutomationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [sendingBulkSMS, setSendingBulkSMS] = useState(false);
  const queryClient = useQueryClient();

  // Automation settings (stored in system_settings)
  const { data: automationSettings } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "collections_automation")
        .maybeSingle();
      
      return data?.value as {
        auto_sms_reminders: boolean;
        auto_escalation: boolean;
        reminder_days_before: number;
        escalation_thresholds: number[];
      } || {
        auto_sms_reminders: true,
        auto_escalation: true,
        reminder_days_before: 3,
        escalation_thresholds: [30, 60, 90],
      };
    },
  });

  // Categorize overdue accounts by escalation level
  const categorizedAccounts = {
    level1: overdueRepayments?.filter(r => differenceInDays(new Date(), new Date(r.due_date)) <= 30) || [],
    level2: overdueRepayments?.filter(r => {
      const days = differenceInDays(new Date(), new Date(r.due_date));
      return days > 30 && days <= 60;
    }) || [],
    level3: overdueRepayments?.filter(r => {
      const days = differenceInDays(new Date(), new Date(r.due_date));
      return days > 60 && days <= 90;
    }) || [],
    level4: overdueRepayments?.filter(r => differenceInDays(new Date(), new Date(r.due_date)) > 90) || [],
  };

  // PTP reminders due today
  const ptpDueToday = ptpItems?.filter(p => isToday(new Date(p.promise_date))) || [];
  const ptpDueTomorrow = ptpItems?.filter(p => isTomorrow(new Date(p.promise_date))) || [];

  // Send bulk SMS reminders
  const sendBulkReminders = async (type: "overdue" | "ptp_today" | "ptp_tomorrow") => {
    setSendingBulkSMS(true);
    let targets: any[] = [];
    let sentCount = 0;

    try {
      if (type === "overdue") {
        targets = categorizedAccounts.level1.slice(0, 50); // Limit to 50
        for (const item of targets) {
          const days = differenceInDays(new Date(), new Date(item.due_date));
          await smsService.sendOverdueNotice(
            item.loan.phone,
            item.loan.full_name,
            Number(item.amount) + Number(item.penalty_amount || 0),
            days,
            item.loan.user_id
          );
          
          // Log activity
          await supabase.from("collection_activities").insert({
            loan_id: item.loan_id,
            repayment_id: item.id,
            activity_type: "sms",
            notes: `Automated overdue SMS sent - ${days} days overdue`,
            outcome: "sms_sent",
          });
          sentCount++;
        }
      } else if (type === "ptp_today") {
        targets = ptpDueToday.slice(0, 50);
        for (const ptp of targets) {
          await smsService.send({
            to: ptp.loan?.phone,
            message: `Dear ${ptp.loan?.full_name}, this is a reminder that your promised payment of K${Number(ptp.promise_amount || 0).toLocaleString()} is due TODAY. Please ensure payment is made to maintain your commitment. - Phindu Finance`,
            title: "PTP Reminder"
          });
          
          await supabase.from("collection_activities").insert({
            loan_id: ptp.loan_id,
            activity_type: "sms",
            notes: "Automated PTP due today reminder sent",
            outcome: "sms_sent",
          });
          sentCount++;
        }
      } else if (type === "ptp_tomorrow") {
        targets = ptpDueTomorrow.slice(0, 50);
        for (const ptp of targets) {
          await smsService.send({
            to: ptp.loan?.phone,
            message: `Dear ${ptp.loan?.full_name}, this is a reminder that your promised payment of K${Number(ptp.promise_amount || 0).toLocaleString()} is due TOMORROW. Please prepare for payment. - Phindu Finance`,
            title: "PTP Reminder"
          });
          
          await supabase.from("collection_activities").insert({
            loan_id: ptp.loan_id,
            activity_type: "sms",
            notes: "Automated PTP due tomorrow reminder sent",
            outcome: "sms_sent",
          });
          sentCount++;
        }
      }

      toast.success(`Sent ${sentCount} SMS reminders successfully`);
      queryClient.invalidateQueries({ queryKey: ["collection-activities"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to send some reminders");
    } finally {
      setSendingBulkSMS(false);
    }
  };

  // Auto-escalation mutation
  const runAutoEscalation = async () => {
    setIsProcessing(true);
    let escalatedCount = 0;

    try {
      // Escalate accounts based on days overdue
      for (const item of categorizedAccounts.level2) {
        // Check if already escalated
        const { data: existing } = await supabase
          .from("collection_activities")
          .select("id")
          .eq("loan_id", item.loan_id)
          .eq("activity_type", "escalation")
          .eq("escalation_level", 2)
          .maybeSingle();

        if (!existing) {
          await supabase.from("collection_activities").insert({
            loan_id: item.loan_id,
            repayment_id: item.id,
            activity_type: "escalation",
            notes: "Automated escalation - 30+ days overdue",
            outcome: "escalated_to_level_2",
            escalation_level: 2,
          });
          
          // Send escalation SMS
          await smsService.sendCollectionReminder(
            item.loan.phone,
            item.loan.full_name,
            Number(item.amount),
            2,
            item.loan.user_id
          );
          escalatedCount++;
        }
      }

      for (const item of categorizedAccounts.level3) {
        const { data: existing } = await supabase
          .from("collection_activities")
          .select("id")
          .eq("loan_id", item.loan_id)
          .eq("activity_type", "escalation")
          .eq("escalation_level", 3)
          .maybeSingle();

        if (!existing) {
          await supabase.from("collection_activities").insert({
            loan_id: item.loan_id,
            repayment_id: item.id,
            activity_type: "escalation",
            notes: "Automated escalation - 60+ days overdue (Recovery Team)",
            outcome: "escalated_to_level_3",
            escalation_level: 3,
          });
          
          await smsService.sendCollectionReminder(
            item.loan.phone,
            item.loan.full_name,
            Number(item.amount),
            3,
            item.loan.user_id
          );
          escalatedCount++;
        }
      }

      for (const item of categorizedAccounts.level4) {
        const { data: existing } = await supabase
          .from("collection_activities")
          .select("id")
          .eq("loan_id", item.loan_id)
          .eq("activity_type", "escalation")
          .eq("escalation_level", 4)
          .maybeSingle();

        if (!existing) {
          await supabase.from("collection_activities").insert({
            loan_id: item.loan_id,
            repayment_id: item.id,
            activity_type: "escalation",
            notes: "Automated escalation - 90+ days overdue (Legal/Write-off consideration)",
            outcome: "escalated_to_level_4",
            escalation_level: 4,
          });
          
          await smsService.sendCollectionReminder(
            item.loan.phone,
            item.loan.full_name,
            Number(item.amount),
            4,
            item.loan.user_id
          );
          escalatedCount++;
        }
      }

      toast.success(`Auto-escalation complete: ${escalatedCount} accounts escalated`);
      queryClient.invalidateQueries({ queryKey: ["overdue-repayments"] });
      queryClient.invalidateQueries({ queryKey: ["collection-activities"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to run auto-escalation");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot size={20} className="text-primary" />
          Collections Automation
        </CardTitle>
        <CardDescription>
          Automated SMS reminders and escalation workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-warning" />
              <span className="text-xs font-medium text-warning">1-30 Days</span>
            </div>
            <p className="text-2xl font-bold">{categorizedAccounts.level1.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle size={14} className="text-orange-500" />
              <span className="text-xs font-medium text-orange-500">31-60 Days</span>
            </div>
            <p className="text-2xl font-bold">{categorizedAccounts.level2.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-destructive" />
              <span className="text-xs font-medium text-destructive">61-90 Days</span>
            </div>
            <p className="text-2xl font-bold">{categorizedAccounts.level3.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-500">90+ Days</span>
            </div>
            <p className="text-2xl font-bold">{categorizedAccounts.level4.length}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Send size={14} /> Bulk SMS Actions
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendBulkReminders("overdue")}
              disabled={sendingBulkSMS || categorizedAccounts.level1.length === 0}
            >
              {sendingBulkSMS ? <Loader2 size={14} className="animate-spin mr-1" /> : <MessageSquare size={14} className="mr-1" />}
              SMS Overdue (1-30d) ({categorizedAccounts.level1.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendBulkReminders("ptp_today")}
              disabled={sendingBulkSMS || ptpDueToday.length === 0}
            >
              {sendingBulkSMS ? <Loader2 size={14} className="animate-spin mr-1" /> : <Bell size={14} className="mr-1" />}
              SMS PTP Today ({ptpDueToday.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendBulkReminders("ptp_tomorrow")}
              disabled={sendingBulkSMS || ptpDueTomorrow.length === 0}
            >
              {sendingBulkSMS ? <Loader2 size={14} className="animate-spin mr-1" /> : <Bell size={14} className="mr-1" />}
              SMS PTP Tomorrow ({ptpDueTomorrow.length})
            </Button>
          </div>
        </div>

        {/* Auto-Escalation */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ArrowUpCircle size={14} /> Auto-Escalation
          </h4>
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <p className="text-sm text-muted-foreground">
              Automatically escalate overdue accounts based on days overdue:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Level 2</Badge>
                30+ days - Senior Collections
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Level 3</Badge>
                60+ days - Recovery Team
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Level 4</Badge>
                90+ days - Legal/Write-off
              </li>
            </ul>
            <Button
              onClick={runAutoEscalation}
              disabled={isProcessing}
              className="w-full mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap size={14} className="mr-2" />
                  Run Auto-Escalation Now
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
