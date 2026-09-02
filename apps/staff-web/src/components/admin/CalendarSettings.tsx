import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Loader2, Save, Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { shiftPendingRepaymentsToBusinessDays } from "@phinduloans/shared/services/repositories/coreWritesRepository";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import {
  BusinessCalendar,
  DEFAULT_BUSINESS_CALENDAR,
  WEEKDAY_OPTIONS,
  parseBusinessCalendar,
  invalidateBusinessCalendarCache,
} from "@phinduloans/shared/lib/businessCalendar";

const CalendarSettings = () => {
  const { toast } = useToast();
  const [calendar, setCalendar] = useState<BusinessCalendar>(DEFAULT_BUSINESS_CALENDAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "business_calendar")
        .maybeSingle();
      if (error) throw error;
      setCalendar(parseBusinessCalendar(data?.value));
    } catch (e: any) {
      toast({ title: "Failed to load calendar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleWeekday(day: number, checked: boolean) {
    setCalendar((c) => {
      const set = new Set(c.non_working_weekdays);
      if (checked) set.add(day);
      else set.delete(day);
      return { ...c, non_working_weekdays: Array.from(set).sort((a, b) => a - b) };
    });
  }

  function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) {
      toast({ title: "Invalid date", description: "Use format YYYY-MM-DD", variant: "destructive" });
      return;
    }
    setCalendar((c) => {
      if (c.holidays.includes(newHoliday)) return c;
      return { ...c, holidays: [...c.holidays, newHoliday].sort() };
    });
    setNewHoliday("");
  }

  function removeHoliday(date: string) {
    setCalendar((c) => ({ ...c, holidays: c.holidays.filter((h) => h !== date) }));
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { key: "business_calendar", value: calendar as any, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
      invalidateBusinessCalendarCache();
      toast({ title: "Saved", description: "Business calendar updated. New schedules will use these rules." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function shiftPending() {
    if (!confirm("Shift all future pending installments off non-working days to the next allowed day?")) return;
    setShifting(true);
    try {
      const row = await shiftPendingRepaymentsToBusinessDays();
      toast({
        title: "Schedules updated",
        description: `${row?.shifted_count ?? 0} installments moved across ${row?.loans_touched ?? 0} active loans.`,
      });
    } catch (e: any) {
      toast({ title: "Shift failed", description: e.message, variant: "destructive" });
    } finally {
      setShifting(false);
    }
  }

  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle>Business Calendar</CardTitle>
        <CardDescription>
          Days flagged here are skipped automatically by all repayment schedules and payment reminders. Existing pending
          installments can also be shifted forward in one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Non-working weekdays</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WEEKDAY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 cursor-pointer"
              >
                <Checkbox
                  checked={calendar.non_working_weekdays.includes(opt.value)}
                  onCheckedChange={(v) => toggleWeekday(opt.value, v === true)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Default: Sunday off. Tick additional days if you don't collect on them.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Specific holidays</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="max-w-xs"
            />
            <Button type="button" variant="outline" onClick={addHoliday}>
              <Plus className="mr-1 h-4 w-4" /> Add holiday
            </Button>
          </div>
          {calendar.holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground">No holidays configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {calendar.holidays.map((h) => (
                <Badge key={h} variant="secondary" className="gap-1.5 py-1.5 pl-2.5 pr-1">
                  {h}
                  <button
                    type="button"
                    onClick={() => removeHoliday(h)}
                    className="rounded p-0.5 hover:bg-destructive/20"
                    aria-label={`Remove ${h}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground max-w-md">
            Saving updates the calendar for all <strong>new</strong> repayment schedules and reminders. Use “Shift
            pending installments” to also move already-scheduled future installments off non-working days.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={shiftPending} disabled={shifting}>
              {shifting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Shift pending installments
            </Button>
            <Button onClick={save} disabled={saving} className="gradient-primary">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save calendar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarSettings;
