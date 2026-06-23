import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  ShieldCheck,
  Wrench,
  Paperclip,
  FileText,
  ImageIcon,
} from "lucide-react";
import { cn } from "@phinduloans/shared/lib/utils";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { toast } from "sonner";

type AgentKey = "phindu" | "guardian" | "senior_engineer";

interface AgentDef {
  key: AgentKey;
  name: string;
  short: string;
  tagline: string;
  greeting: string;
  icon: typeof Sparkles;
  staffOnly?: boolean;
  quickPrompts: string[];
}

const AGENTS: AgentDef[] = [
  {
    key: "phindu",
    name: "Phindu Assistant",
    short: "Assistant",
    tagline: "Always here to help",
    greeting:
      "👋 Hi! I'm your **Phindu Assistant**. Ask me anything about loans, repayments, reports — or attach a file and I'll help.",
    icon: Sparkles,
    quickPrompts: ["What can you help me with?", "How do repayments work?", "Where do I disburse a loan?"],
  },
  {
    key: "guardian",
    name: "Guardian AI",
    short: "Guardian",
    tagline: "Operations brain · live",
    greeting:
      "🛡️ **Guardian AI** here. I watch your portfolio in real time — arrears, PAR, collections and risk. Ask me how the book looks today.",
    icon: ShieldCheck,
    staffOnly: true,
    quickPrompts: ["How is the portfolio today?", "What's overdue right now?", "Any risks I should act on?"],
  },
  {
    key: "senior_engineer",
    name: "Senior Engineer AI",
    short: "Engineer",
    tagline: "Reliability watchdog",
    greeting:
      "🛠️ **Senior Engineer AI** here. I monitor system health — APIs, repayments engine, notifications and data integrity. Ask me if anything's broken.",
    icon: Wrench,
    staffOnly: true,
    quickPrompts: ["Is the system healthy?", "Any failed notifications?", "Show recent errors"],
  },
];

const STORAGE_POS = "phindu_assistant_pos";
const STORAGE_GREETED = "phindu_assistant_greeted";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const MAX_FILE_MB = 12;

interface Attachment {
  kind: "image" | "pdf" | "text";
  name: string;
  mime: string;
  dataUrl?: string; // for image/pdf
  text?: string; // for text files
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

function getInitialPos() {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { x: window.innerWidth - 80, y: window.innerHeight - 96 };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });
}

export default function FloatingAssistant() {
  const location = useLocation();
  const { user, isStaff } = useAuth();

  const [pos, setPos] = useState(getInitialPos);
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [agentKey, setAgentKey] = useState<AgentKey>("phindu");
  const [convos, setConvos] = useState<Record<AgentKey, ChatMessage[]>>({
    phindu: [],
    guardian: [],
    senior_engineer: [],
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [unread, setUnread] = useState(0);

  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const availableAgents = AGENTS.filter((a) => !a.staffOnly || isStaff);
  const activeAgent = AGENTS.find((a) => a.key === agentKey)!;
  const messages = convos[agentKey];

  // One-time greeting bubble
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_GREETED)) return;
    const t = setTimeout(() => setShowGreeting(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Keep in viewport on resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - 64),
        y: Math.min(p.y, window.innerHeight - 64),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open, agentKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // ── Proactive Guardian alerts via realtime findings ──
  useEffect(() => {
    if (!isStaff) return;
    const channel = supabase
      .channel("guardian-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_agent_findings" },
        (payload) => {
          const f = payload.new as {
            agent_key: string;
            title: string;
            severity: string;
            recommendation?: string;
            body?: string;
          };
          const sev = (f.severity || "info").toLowerCase();
          if (!["medium", "high", "critical"].includes(sev)) return;

          const isGuardian = f.agent_key === "guardian";
          const Icon = isGuardian ? "🛡️" : "🛠️";
          const fn = sev === "critical" || sev === "high" ? toast.error : toast.warning;
          fn(`${Icon} ${isGuardian ? "Guardian AI" : "Senior Engineer AI"} alert`, {
            description: f.title,
            duration: 12000,
            action: {
              label: "Open",
              onClick: () => {
                setAgentKey(f.agent_key === "senior_engineer" ? "senior_engineer" : "guardian");
                setOpen(true);
              },
            },
          });
          if (!openRef.current) setUnread((u) => u + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStaff]);

  const persistPos = useCallback((p: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_POS, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const dismissGreeting = () => {
    setShowGreeting(false);
    try {
      localStorage.setItem(STORAGE_GREETED, "1");
    } catch {
      /* ignore */
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = false;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const nx = e.clientX - offsetRef.current.x;
    const ny = e.clientY - offsetRef.current.y;
    if (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3) movedRef.current = true;
    setPos({
      x: Math.max(8, Math.min(nx, window.innerWidth - 64)),
      y: Math.max(8, Math.min(ny, window.innerHeight - 64)),
    });
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    persistPos(pos);
    if (!movedRef.current) {
      dismissGreeting();
      setOpen((o) => !o);
    }
  };

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" is too large (max ${MAX_FILE_MB}MB).`);
        continue;
      }
      try {
        if (file.type.startsWith("image/")) {
          next.push({ kind: "image", name: file.name, mime: file.type, dataUrl: await readFileAsDataUrl(file) });
        } else if (file.type === "application/pdf") {
          next.push({ kind: "pdf", name: file.name, mime: file.type, dataUrl: await readFileAsDataUrl(file) });
        } else if (
          file.type.startsWith("text/") ||
          /\.(txt|csv|md|json|log|tsv|xml|yaml|yml)$/i.test(file.name)
        ) {
          const text = await readFileAsText(file);
          next.push({ kind: "text", name: file.name, mime: file.type || "text/plain", text: text.slice(0, 20000) });
        } else {
          toast.error(`"${file.name}" — I can read images, PDFs and text files.`);
        }
      } catch {
        toast.error(`Couldn't read "${file.name}".`);
      }
    }
    if (next.length) setPending((p) => [...p, ...next]);
  }

  function buildApiContent(text: string, attachments: Attachment[]) {
    if (attachments.length === 0) return text;
    const blocks: unknown[] = [];
    let textPart = text;
    for (const a of attachments) {
      if (a.kind === "text" && a.text) {
        textPart += `\n\n--- Attached file: ${a.name} ---\n${a.text}`;
      }
    }
    blocks.push({ type: "text", text: textPart || "(see attached)" });
    for (const a of attachments) {
      if (a.kind === "image" && a.dataUrl) {
        blocks.push({ type: "image_url", image_url: { url: a.dataUrl } });
      } else if (a.kind === "pdf" && a.dataUrl) {
        blocks.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
      }
    }
    return blocks;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && pending.length === 0) || streaming) return;
    const attachments = pending;
    setInput("");
    setPending([]);

    const history = [...convos[agentKey], { role: "user" as const, content: trimmed, attachments }];
    setConvos((c) => ({ ...c, [agentKey]: [...history, { role: "assistant", content: "" }] }));
    setStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? ANON_KEY;

      const apiMessages = history.map((m) => ({
        role: m.role,
        content: buildApiContent(m.content, m.attachments ?? []),
      }));

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agent: agentKey, messages: apiMessages, context: location.pathname }),
      });

      if (!resp.ok || !resp.body) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || "I couldn't respond right now.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setConvos((c) => {
                const arr = [...c[agentKey]];
                arr[arr.length - 1] = {
                  role: "assistant",
                  content: arr[arr.length - 1].content + delta,
                };
                return { ...c, [agentKey]: arr };
              });
            }
          } catch {
            /* partial json */
          }
        }
      }
    } catch (err) {
      setConvos((c) => {
        const arr = [...c[agentKey]];
        arr[arr.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        };
        return { ...c, [agentKey]: arr };
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const panelRight = pos.x > window.innerWidth / 2;
  const panelBottom = pos.y > window.innerHeight / 2;
  const BubbleIcon = activeAgent.icon;

  return createPortal(
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[60] flex h-[min(72vh,600px)] w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          style={{
            left: panelRight ? undefined : Math.max(8, pos.x),
            right: panelRight ? Math.max(8, window.innerWidth - pos.x - 56) : undefined,
            top: panelBottom ? undefined : pos.y + 64,
            bottom: panelBottom ? Math.max(8, window.innerHeight - pos.y) + 8 : undefined,
          }}
        >
          {/* Header */}
          <div className="bg-primary px-3 pt-3 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
                  <BubbleIcon className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{activeAgent.name}</p>
                  <p className="text-[11px] opacity-80">{activeAgent.tagline}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 transition hover:bg-primary-foreground/15"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Agent switcher */}
            <div className="mt-3 flex gap-1 overflow-x-auto pb-px">
              {availableAgents.map((a) => {
                const Icon = a.icon;
                const active = a.key === agentKey;
                return (
                  <button
                    key={a.key}
                    onClick={() => setAgentKey(a.key)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition",
                      active
                        ? "bg-card text-foreground"
                        : "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {a.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm shadow-sm">
                  <ReactMarkdown>{activeAgent.greeting}</ReactMarkdown>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeAgent.quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary transition hover:bg-primary/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-card text-foreground",
                  )}
                >
                  {/* attachments preview (user) */}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {m.attachments.map((a, idx) =>
                        a.kind === "image" && a.dataUrl ? (
                          <img
                            key={idx}
                            src={a.dataUrl}
                            alt={a.name}
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-primary-foreground/30"
                          />
                        ) : (
                          <span
                            key={idx}
                            className="flex items-center gap-1 rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px]"
                          >
                            <FileText className="h-3 w-3" /> {a.name}
                          </span>
                        ),
                      )}
                    </div>
                  )}

                  {m.role === "assistant" && m.content === "" && streaming ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </span>
                  ) : m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pending attachments */}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border bg-card px-2 pt-2">
              {pending.map((a, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-foreground"
                >
                  {a.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  <span className="max-w-[120px] truncate">{a.name}</span>
                  <button
                    onClick={() => setPending((p) => p.filter((_, j) => j !== idx))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="flex items-end gap-1.5 border-t border-border bg-card p-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.csv,.md,.json,.log,.txt,.yaml,.yml,.xml"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Attach file"
              title="Attach image, PDF or text file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              placeholder={`Message ${activeAgent.short}…`}
              className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || (!input.trim() && pending.length === 0)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send message"
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Greeting tooltip */}
      {showGreeting && !open && (
        <div
          className="fixed z-[59] w-56 animate-in fade-in slide-in-from-bottom-2"
          style={{
            left: panelRight ? undefined : Math.max(8, pos.x - 160),
            right: panelRight ? Math.max(8, window.innerWidth - pos.x - 56) : undefined,
            top: pos.y - 8,
          }}
        >
          <div className="relative rounded-2xl bg-card px-3 py-2 text-xs shadow-xl ring-1 ring-border">
            <button
              onClick={dismissGreeting}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-muted p-0.5 text-muted-foreground shadow"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="font-semibold text-primary">Hi there! 👋</span> I'm your new assistant
            {isStaff ? " — with Guardian & Engineer AI built in" : ""}. Tap me anytime.
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          "fixed z-[60] flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20 transition-transform hover:scale-105 active:scale-95",
        )}
        style={{ left: pos.x, top: pos.y, cursor: "grab" }}
        aria-label="Open Phindu Assistant"
      >
        {!open && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
        {open ? <X className="relative h-6 w-6" /> : <BubbleIcon className="relative h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>,
    document.body,
  );
}
