import { useEffect, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Notif = { id: string; title: string; body: string | null; type: string; read: boolean; link: string | null; created_at: string };

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const seenIds = useRef<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20)).data as Notif[] ?? [],
    enabled: !!user,
  });

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
  }, []);

  // Seed seen ids on first load so we don't fire push for backlog
  useEffect(() => {
    if (notifications.length && seenIds.current.size === 0) {
      notifications.forEach((n) => seenIds.current.add(n.id));
    }
  }, [notifications]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          qc.invalidateQueries({ queryKey: ["notifications"] });
          toast(n.title, { description: n.body ?? undefined });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try { new Notification(n.title, { body: n.body ?? "", icon: "/favicon.ico", tag: n.id }); } catch { /* ignore */ }
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notificações ativadas");
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const dismiss = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Notificações"
        className="relative size-10 shrink-0 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-mono flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border-subtle rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-medium">Notificações</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[11px] font-mono text-primary hover:underline">marcar todas</button>
              )}
            </div>
            {permission !== "granted" && "Notification" in (typeof window !== "undefined" ? window : {}) && (
              <button onClick={requestPermission} className="w-full text-left px-4 py-2.5 text-xs bg-primary/5 border-b border-border-subtle text-primary hover:bg-primary/10">
                Ativar notificações do navegador →
              </button>
            )}
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">Nada por aqui ainda.</div>
              ) : notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-border-subtle last:border-0 group flex gap-2 ${!n.read ? "bg-primary/[0.03]" : ""}`}>
                  <div className={`size-1.5 rounded-full mt-2 shrink-0 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">{new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                    {!n.read && <button onClick={() => markRead(n.id)} title="Marcar lida" className="text-muted-foreground hover:text-primary"><Check className="size-3" /></button>}
                    <button onClick={() => dismiss(n.id)} title="Remover" className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setOpen(false); navigate({ to: "/notifications" }); }}
              className="w-full px-4 py-2.5 text-xs text-center text-muted-foreground hover:text-foreground border-t border-border-subtle">
              Ver todas
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
