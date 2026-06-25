import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificações — FOCUS" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const markRead = async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); qc.invalidateQueries({ queryKey: ["notifications"] }); };

  return (
    <AppShell title="Notificações" subtitle={`${data.filter((n) => !n.read).length} não lidas`}>
      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        {data.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground"><Bell className="size-6 mx-auto mb-2 opacity-50" />Sem notificações.</div>
          : data.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? "bg-primary/5" : ""}`}>
              <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${n.type === "ai" ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground"}`}><Bell className="size-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] font-mono text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </div>
              {!n.read && <button onClick={() => markRead(n.id)} className="size-7 rounded-md text-muted-foreground hover:text-primary"><Check className="size-3.5 mx-auto" /></button>}
            </div>
          ))}
      </div>
    </AppShell>
  );
}
