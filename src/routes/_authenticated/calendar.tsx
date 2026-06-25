import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendário — FOCUS" }] }),
  component: CalendarPage,
});

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "list">("month");

  const monthStart = useMemo(() => { const d = new Date(cursor); d.setHours(0, 0, 0, 0); return d; }, [cursor]);
  const monthEnd = useMemo(() => { const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59); return d; }, [monthStart]);

  const { data: events = [] } = useQuery({
    queryKey: ["events", monthStart.toISOString()],
    queryFn: async () => (await supabase.from("calendar_events").select("*")
      .gte("start_at", new Date(monthStart.getTime() - 7 * 86400000).toISOString())
      .lte("start_at", new Date(monthEnd.getTime() + 7 * 86400000).toISOString())
      .order("start_at")).data ?? [],
  });

  const days = useMemo(() => {
    const first = new Date(monthStart);
    const startDow = first.getDay();
    const grid: Date[] = [];
    for (let i = 0; i < startDow; i++) { const d = new Date(first); d.setDate(d.getDate() - (startDow - i)); grid.push(d); }
    const total = monthEnd.getDate();
    for (let i = 1; i <= total; i++) { const d = new Date(monthStart); d.setDate(i); grid.push(d); }
    while (grid.length % 7 !== 0 || grid.length < 42) { const d = new Date(grid[grid.length - 1]); d.setDate(d.getDate() + 1); grid.push(d); if (grid.length >= 42) break; }
    return grid;
  }, [monthStart, monthEnd]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, typeof events> = {};
    events.forEach((e) => {
      const k = new Date(e.start_at).toDateString();
      (map[k] ??= []).push(e);
    });
    return map;
  }, [events]);

  const remove = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <AppShell title="Calendário" subtitle={`${events.length} eventos · ${monthLabel}`} status={status}
      actions={
        <div className="flex gap-2">
          <button onClick={() => setView(view === "month" ? "list" : "month")} className="h-10 px-3 bg-surface border border-border-subtle rounded-lg text-xs font-mono uppercase">{view === "month" ? "Lista" : "Mês"}</button>
          <button onClick={() => setSelectedDate(new Date())} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="size-4" />Novo</button>
        </div>
      }>
      {view === "month" ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="size-9 bg-surface border border-border-subtle rounded-lg flex items-center justify-center hover:bg-white/5"><ChevronLeft className="size-4" /></button>
            <h2 className="text-lg font-light capitalize">{monthLabel}</h2>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="size-9 bg-surface border border-border-subtle rounded-lg flex items-center justify-center hover:bg-white/5"><ChevronRight className="size-4" /></button>
          </div>

          <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border-subtle">
              {WEEK.map((w) => <div key={w} className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
              {days.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = d.getTime() === today.getTime();
                const dayEvents = eventsByDay[d.toDateString()] ?? [];
                return (
                  <button key={i} onClick={() => setSelectedDate(d)}
                    className={`min-h-[80px] md:min-h-[110px] border-r border-b border-border-subtle p-2 text-left transition-colors hover:bg-white/5 ${!inMonth ? "opacity-30" : ""} ${isToday ? "bg-primary/5" : ""}`}>
                    <span className={`text-xs font-mono ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{d.getDate()}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="text-[10px] truncate bg-primary/15 text-primary rounded px-1.5 py-0.5">{e.title}</div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum evento neste período.</p>
          ) : events.map((e) => (
            <div key={e.id} className="bg-surface border border-border-subtle rounded-xl px-4 py-3 flex items-center gap-4 group">
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(e.start_at).toLocaleDateString("pt-BR", { month: "short" })}</div>
                <div className="text-xl font-light">{new Date(e.start_at).getDate()}</div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedDate && (
          <DayModal
            date={selectedDate}
            events={eventsByDay[selectedDate.toDateString()] ?? []}
            onClose={() => setSelectedDate(null)}
            onCreate={async (title, startAt) => {
              set("saving");
              const end = new Date(startAt.getTime() + 60 * 60 * 1000);
              const { error } = await supabase.from("calendar_events").insert({
                user_id: user!.id, title, start_at: startAt.toISOString(), end_at: end.toISOString(),
              });
              if (error) { set("error"); } else { set("saved"); qc.invalidateQueries({ queryKey: ["events"] }); }
            }}
            onRemove={remove}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function DayModal({ date, events, onClose, onCreate, onRemove }: {
  date: Date;
  events: Array<{ id: string; title: string; start_at: string }>;
  onClose: () => void;
  onCreate: (title: string, startAt: Date) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");

  const submit = async () => {
    if (!title.trim()) return;
    const [hh, mm] = time.split(":").map(Number);
    const d = new Date(date); d.setHours(hh, mm, 0, 0);
    await onCreate(title.trim(), d);
    setTitle("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg capitalize">{date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h2>
            <p className="text-[11px] font-mono text-muted-foreground">{events.length} eventos</p>
          </div>
          <button onClick={onClose}><X className="size-4" /></button>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
          {events.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento.</p>
            : events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 bg-background border border-border-subtle rounded-lg px-3 py-2 group">
                <span className="font-mono text-xs text-primary">{new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-sm flex-1">{e.title}</span>
                <button onClick={() => onRemove(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-border-subtle">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novo evento"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="flex-1 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm outline-none focus:border-primary/40" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-24 bg-background border border-border-subtle rounded-lg px-2 text-sm" />
          <button onClick={submit} className="h-10 px-3 bg-primary text-primary-foreground rounded-lg"><Plus className="size-4" /></button>
        </div>
      </motion.div>
    </motion.div>
  );
}
