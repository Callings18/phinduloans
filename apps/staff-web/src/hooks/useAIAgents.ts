/**
 * useAIAgents — data access for the AI Agents module.
 * Agents OBSERVE ONLY: these hooks read agent config/runs/findings and trigger
 * server-side runs via the `ai-agent-run` edge function. No platform data is
 * mutated here.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export interface AIAgent {
  id: string;
  agent_key: string;
  name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  autonomy_level: "observe" | "advise" | "act";
  schedule_cron: string | null;
  last_run_at: string | null;
}

export interface AIAgentRun {
  id: string;
  agent_key: string;
  trigger: string;
  status: "running" | "success" | "error";
  summary: string | null;
  error_message: string | null;
  tokens_used: number | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface AIAgentFinding {
  id: string;
  agent_key: string;
  run_id: string | null;
  title: string;
  body: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string | null;
  recommendation: string | null;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  created_at: string;
}

/** Agents that have a working server-side implementation today. */
export const IMPLEMENTED_AGENTS = new Set(["guardian", "senior_engineer"]);

export function useAIAgents() {
  return useQuery({
    queryKey: ["ai-agents"],
    queryFn: async (): Promise<AIAgent[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AIAgent[];
    },
    staleTime: 30_000,
  });
}

export function useAgentRuns(agentKey: string) {
  return useQuery({
    queryKey: ["ai-agent-runs", agentKey],
    queryFn: async (): Promise<AIAgentRun[]> => {
      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .eq("agent_key", agentKey)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as AIAgentRun[];
    },
    enabled: !!agentKey,
  });
}

export function useAgentFindings(agentKey?: string) {
  return useQuery({
    queryKey: ["ai-agent-findings", agentKey ?? "all"],
    queryFn: async (): Promise<AIAgentFinding[]> => {
      let query = supabase
        .from("ai_agent_findings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (agentKey) query = query.eq("agent_key", agentKey);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AIAgentFinding[];
    },
  });
}

export function useToggleAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("ai_agents").update({ is_enabled: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
}

export function useRunAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agentKey: string) => {
      const { data, error } = await supabase.functions.invoke("ai-agent-run", {
        body: { agent_key: agentKey, trigger: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, agentKey) => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      qc.invalidateQueries({ queryKey: ["ai-agent-runs", agentKey] });
      qc.invalidateQueries({ queryKey: ["ai-agent-findings", agentKey] });
      qc.invalidateQueries({ queryKey: ["ai-agent-findings", "all"] });
    },
  });
}

export function useUpdateFindingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AIAgentFinding["status"] }) => {
      const { error } = await supabase
        .from("ai_agent_findings")
        .update({ status, acknowledged_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agent-findings"] });
    },
  });
}
