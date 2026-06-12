/**
 * AdminAIAgents — isolated, observe-only AI Agents module landing page.
 * Lists all agents; lets staff enable/disable and trigger a run. Gated behind
 * the `ai_agents_enabled` feature flag.
 */
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Play, AlertTriangle, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import {
  useAIAgents,
  useToggleAgent,
  useRunAgent,
  IMPLEMENTED_AGENTS,
} from "@/hooks/useAIAgents";

const AdminAIAgents = () => {
  const { isEnabled, isLoading: flagLoading } = useFeatureFlag("ai_agents_enabled");
  const { data: agents, isLoading } = useAIAgents();
  const toggle = useToggleAgent();
  const runAgent = useRunAgent();
  const { toast } = useToast();

  const handleRun = (key: string, name: string) => {
    toast({ title: `${name} is running…`, description: "Observing data and generating findings." });
    runAgent.mutate(key, {
      onSuccess: (d: any) =>
        toast({ title: `${name} finished`, description: `${d?.findings_count ?? 0} finding(s) generated.` }),
      onError: (e: Error) => toast({ title: `${name} failed`, description: e.message, variant: "destructive" }),
    });
  };

  if (flagLoading || isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isEnabled) {
    return (
      <AdminLayout>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-6 flex gap-3 items-center">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-foreground">
              The AI Agents module is currently disabled. Enable it from Feature flags to use it.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-8 w-8 text-primary mt-1" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
            <p className="text-muted-foreground mt-1">
              Autonomous AI assistants that observe the platform and advise your team. Agents are
              <strong> observe-only</strong> — they never change loans, repayments, balances, or approvals.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(agents ?? []).map((agent) => {
            const implemented = IMPLEMENTED_AGENTS.has(agent.agent_key);
            return (
              <Card key={agent.id} className={!implemented ? "opacity-70" : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Switch
                      checked={agent.is_enabled}
                      disabled={!implemented || toggle.isPending}
                      onCheckedChange={(next) => toggle.mutate({ id: agent.id, next })}
                    />
                  </div>
                  <CardDescription className="line-clamp-3 min-h-[3.5rem]">
                    {agent.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{agent.category}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <Eye className="h-3 w-3" /> {agent.autonomy_level}
                    </Badge>
                    {!implemented && <Badge variant="outline">Coming soon</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agent.last_run_at
                      ? `Last run ${formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}`
                      : "Never run"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!implemented || !agent.is_enabled || runAgent.isPending}
                      onClick={() => handleRun(agent.agent_key, agent.name)}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" /> Run now
                    </Button>
                    {implemented && (
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/admin/ai-agents/${agent.agent_key}`}>View</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAIAgents;
