import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAI } from "@/lib/ai.functions";
import { useAuth } from "@/hooks/use-auth";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

export function FloatingAI() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const chat = useServerFn(chatWithAI);
  const scrollRef = useRef<HTMLDivElement>(null);

  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Eduardo";

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: `Olá, ${name}. Sou a **FOCUS AI**. Posso ajudar a organizar tarefas, criar planos, resumir notas e analisar sua produtividade. Por onde começamos?` }]);
    }
  }, [open, messages.length, name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      if (detail?.prompt) setInput(detail.prompt);
    };
    window.addEventListener("focus:open-ai", handler);
    return () => window.removeEventListener("focus:open-ai", handler);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await chat({
        data: {
          conversationId: convId,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (res.ok) {
        setConvId(res.conversationId);
        setMessages([...next, { role: "assistant", content: res.reply || "(sem resposta)" }]);
      } else {
        setMessages([...next, { role: "assistant", content: `⚠️ ${res.error}` }]);
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ Erro de conexão: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        aria-label="Abrir FOCUS AI"
        className="fixed bottom-5 right-5 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 flex items-center justify-center focus-glow"
      >
        <Sparkles className="size-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 240 }}
            className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-2.5rem)] bg-surface border border-border-subtle rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="size-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">FOCUS AI</p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Context Engine local</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`size-7 rounded-md shrink-0 flex items-center justify-center text-xs ${m.role === "user" ? "bg-surface-2 text-foreground" : "bg-primary/15 text-primary"}`}>
                    {m.role === "user" ? <UserIcon className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>
                  <div className={`text-sm max-w-[85%] rounded-xl px-3 py-2 prose prose-sm prose-invert prose-p:my-1 prose-pre:my-2 ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-background/60 text-foreground border border-border-subtle"}`}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="size-7 rounded-md bg-primary/15 text-primary flex items-center justify-center"><Bot className="size-3.5" /></div>
                  <div className="text-sm rounded-xl px-3 py-2 bg-background/60 border border-border-subtle flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> pensando…
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border-subtle">
              <div className="flex items-center gap-2 bg-background border border-border-subtle rounded-lg px-3 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Pergunte qualquer coisa…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled={loading}
                />
                <button onClick={send} disabled={loading || !input.trim()} aria-label="Enviar"
                  className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
