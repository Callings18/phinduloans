/**
 * AdminAIAgentDetail — run history + findings feed for a single AI agent.
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  useAIAgents,
  useAgentRuns,
  useAgentFindings,
  useRunAgent,
  useUpdateFindingStatus,
  type AIAgentFinding,
} from "@/hooks/useAIAgents";

const severityVariant: Record<AIAgentFinding["severity"], string> = {
  info: "bg-muted text-muted-foreground",
  low: "bg-primary/10 text-primary",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

const AdminAIAgentDetail = () => {
  const { agentKey = "" } = useParams();
  const { data: agents } = useAIAgents();
  const { data: runs, isLoading: runsLoading } = useAgentRuns(agentKey);
  const { data: findings, isLoading: findingsLoading } = useAgentFindings(agentKey);
  const runAgent = useRunAgent();
  const updateStatus = useUpdateFindingStatus();
  const { toast } = useToast();

  const agent = agents?.find((a) => a.agent_key === agentKey);

  const handleRun = () => {
    toast({ title: `${agent?.name ?? "Agent"} is running…` });
    runAgent.mutate(agentKey, {
      onSuccess: (d: any) => toast({ title: "Run complete", description: `${d?.findings_count ?? 0} finding(s).` }),
      onError: (e: Error) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ai-agents"><ArrowLeft className="h-4 w-4 mr-1" /> Agents</Link>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{agent?.name ?? agentKey}</h1>
            {agent && <Badge variant="outline" className="capitalize">{agent.autonomy_level}</Badge>}
          </div>
          <Button onClick={handleRun} disabled={runAgent.isPending || !agent?.is_enabled}>
            <Play className="h-4 w-4 mr-1" /> Run now
          </Button>
        </div>
        {agent?.description && <p className="text-muted-foreground">{agent.description}</p>}

        <Tabs defaultValue="findings">
          <TabsList>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="runs">Run history</TabsTrigger>
          </TabsList>

          <TabsContent value="findings" className="space-y-3 mt-4">
            {findingsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (findings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No findings yet. Run the agent to generate insights.</p>
            ) : (
              (findings ?? []).map((f) => (
                <Card key={f.id} className={f.status === "dismissed" || f.status === "resolved" ? "opacity-60" : undefined}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{f.title}</CardTitle>
                      <Badge className={severityVariant[f.severity]}>{f.severity}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {f.body && <p className="text-sm text-foreground whitespace-pre-wrap">{f.body}</p>}
                    {f.recommendation && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        <strong>Recommendation: </strong>{f.recommendation}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })} · {f.status}
                      </span>
                      {(f.status === "open" || f.status === "acknowledged") && (
                        <div className="flex gap-2">
                          {f.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: f.id, status: "acknowledged" })}>
                              Acknowledge
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: f.id, status: "resolved" })}>
                            Resolve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: f.id, status: "dismissed" })}>
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="runs" className="space-y-3 mt-4">
            {runsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (runs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No runs yet.</p>
            ) : (
              (runs ?? []).map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {r.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : r.status === "error" ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {r.trigger} run
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {r.summary && <p className="text-sm text-foreground whitespace-pre-wrap">{r.summary}</p>}
                    {r.error_message && <p className="text-sm text-destructive">{r.error_message}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAIAgentDetail;
