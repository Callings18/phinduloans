import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import { MessageCircle, X, Send, Loader2, Sparkles, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_POS = "phindu_assistant_pos";
const STORAGE_GREETED = "phindu_assistant_greeted";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const QUICK_PROMPTS = [
  "What can you help me with?",
  "How do repayments work?",
  "Where do I disburse a loan?",
];

function getInitialPos() {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  // Default: bottom-right (stored as distance from right/bottom via absolute coords)
  return { x: window.innerWidth - 80, y: window.innerHeight - 96 };
}

export default function FloatingAssistant() {
  const location = useLocation();
  const [pos, setPos] = useState(getInitialPos);
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // One-time greeting bubble
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_GREETED)) return;
    const t = setTimeout(() => setShowGreeting(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Keep within viewport on resize
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
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const persistPos = useCallback((p: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_POS, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

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
    const clamped = {
      x: Math.max(8, Math.min(nx, window.innerWidth - 64)),
      y: Math.max(8, Math.min(ny, window.innerHeight - 64)),
    };
    setPos(clamped);
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    persistPos(pos);
    if (!movedRef.current) {
      setShowGreeting(false);
      try {
        localStorage.setItem(STORAGE_GREETED, "1");
      } catch {
        /* ignore */
      }
      setOpen((o) => !o);
    }
  };

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? ANON_KEY;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: location.pathname,
        }),
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
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const data = trimmedLine.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + delta,
                };
                return copy;
              });
            }
          } catch {
            /* partial json, ignore */
          }
        }
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const panelRight = pos.x > window.innerWidth / 2;
  const panelBottom = pos.y > window.innerHeight / 2;

  return createPortal(
    <>
      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-[60] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
            "h-[min(70vh,560px)]",
          )}
          style={{
            left: panelRight ? undefined : Math.max(8, pos.x),
            right: panelRight ? Math.max(8, window.innerWidth - pos.x - 56) : undefined,
            top: panelBottom ? undefined : pos.y + 64,
            bottom: panelBottom ? Math.max(8, window.innerHeight - pos.y) + 8 : undefined,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Phindu Assistant</p>
                <p className="text-[11px] opacity-80">Always here to help</p>
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

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm shadow-sm">
                  👋 Hi! I'm your <span className="font-semibold text-primary">Phindu Assistant</span>.
                  Ask me anything about loans, repayments, reports or how to get things done here.
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q) => (
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
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-card text-foreground",
                  )}
                >
                  {m.role === "assistant" && m.content === "" && streaming ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </span>
                  ) : m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 border-t border-border bg-card p-2">
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
              placeholder="Ask me anything…"
              className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
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
          className="fixed z-[59] w-52 animate-in fade-in slide-in-from-bottom-2"
          style={{
            left: panelRight ? undefined : Math.max(8, pos.x - 150),
            right: panelRight ? Math.max(8, window.innerWidth - pos.x - 56) : undefined,
            top: pos.y - 8,
          }}
        >
          <div className="relative rounded-2xl bg-card px-3 py-2 text-xs shadow-xl ring-1 ring-border">
            <button
              onClick={() => {
                setShowGreeting(false);
                try {
                  localStorage.setItem(STORAGE_GREETED, "1");
                } catch {
                  /* ignore */
                }
              }}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-muted p-0.5 text-muted-foreground shadow"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="font-semibold text-primary">Hi there! 👋</span> I'm your new assistant.
            Tap me anytime to chat.
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          "fixed z-[60] flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
          "ring-4 ring-primary/20",
        )}
        style={{ left: pos.x, top: pos.y, cursor: "grab" }}
        aria-label="Open Phindu Assistant"
      >
        {!open && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        )}
        {open ? (
          <X className="relative h-6 w-6" />
        ) : (
          <MessageCircle className="relative h-6 w-6" />
        )}
        <GripVertical className="absolute -left-1 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-primary-foreground/50" />
      </button>
    </>,
    document.body,
  );
}
