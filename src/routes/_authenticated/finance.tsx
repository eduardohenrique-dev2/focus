import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2, TrendingUp } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finanças — FOCUS" }] }),
  component: FinancePage,
});

const CATEGORY_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

function FinancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");

  const { data: tx = [] } = useQuery({
    queryKey: ["finance"],
    queryFn: async () =>
      (await supabase.from("finance_transactions").select("*").order("occurred_at", { ascending: false }).limit(500)).data ?? [],
  });

  const totals = tx.reduce(
    (acc, t) => {
      const v = Number(t.amount);
      if (t.type === "income") acc.in += v;
      else if (t.type === "expense") acc.out += v;
      return acc;
    },
    { in: 0, out: 0 },
  );

  // Build last-30-days series
  const series = useMemo(() => {
    const days: { date: string; label: string; in: number; out: number; net: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), in: 0, out: 0, net: 0 });
    }
    const map = new Map(days.map((d) => [d.date, d]));
    tx.forEach((t) => {
      const k = t.occurred_at.slice(0, 10);
      const row = map.get(k);
      if (!row) return;
      const v = Number(t.amount);
      if (t.type === "income") row.in += v;
      else if (t.type === "expense") row.out += v;
    });
    days.forEach((d) => (d.net = d.in - d.out));
    return days;
  }, [tx]);

  // Category breakdown (expenses)
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    tx.filter((t) => t.type === "expense").forEach((t) => {
      const k = t.category || "Outros";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tx]);

  const create = async () => {
    const v = parseFloat(amount.replace(",", "."));
    if (!desc.trim() || !v) return;
    set("saving");
    const { error } = await supabase
      .from("finance_transactions")
      .insert({ user_id: user!.id, description: desc.trim(), amount: v, type, category: category.trim() || null });
    if (error) set("error");
    else {
      set("saved");
      setDesc("");
      setAmount("");
      setCategory("");
      qc.invalidateQueries({ queryKey: ["finance"] });
    }
  };
  const remove = async (id: string) => {
    await supabase.from("finance_transactions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["finance"] });
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppShell title="Finanças" subtitle="Controle pessoal" status={status}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <p className="text-[11px] font-mono uppercase text-muted-foreground">Entradas</p>
          <p className="text-2xl font-light text-primary mt-1">{fmt(totals.in)}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <p className="text-[11px] font-mono uppercase text-muted-foreground">Saídas</p>
          <p className="text-2xl font-light text-destructive mt-1">{fmt(totals.out)}</p>
        </div>
        <div className="bg-gradient-to-br from-primary/15 to-transparent border border-primary/20 rounded-2xl p-5">
          <p className="text-[11px] font-mono uppercase text-primary">Saldo</p>
          <p className="text-2xl font-light mt-1">{fmt(totals.in - totals.out)}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <p className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" />Transações</p>
          <p className="text-2xl font-light mt-1">{tx.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-4">Fluxo de caixa · 30 dias</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" fill="url(#inG)" name="Entradas" />
                <Area type="monotone" dataKey="out" stroke="hsl(var(--destructive))" fill="url(#outG)" name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-4">Despesas por categoria</h3>
          <div className="h-64">
            {byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-20">Sem dados ainda</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-medium mb-4">Saldo líquido diário</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fmt(v)}
              />
              <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                {series.map((d, i) => (
                  <Cell key={i} fill={d.net >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição"
          className="flex-1 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria"
          className="md:w-40 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" inputMode="decimal"
          className="md:w-32 h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")} className="h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm">
          <option value="expense">Saída</option>
          <option value="income">Entrada</option>
        </select>
        <button onClick={create} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="size-4" />Registrar
        </button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        {tx.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Sem transações.</p>
        ) : (
          tx.slice(0, 50).map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 group">
              {t.type === "income" ? <ArrowUpRight className="size-4 text-primary" /> : <ArrowDownRight className="size-4 text-destructive" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.description}</p>
                {t.category && <p className="text-[10px] text-muted-foreground font-mono uppercase">{t.category}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(t.occurred_at).toLocaleDateString("pt-BR")}</span>
              <span className={`text-sm font-mono tabular-nums ${t.type === "income" ? "text-primary" : "text-destructive"}`}>
                {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
              </span>
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
