import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Download, Pause, Play, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/studies")({
  head: () => ({ meta: [{ title: "Estudos — FOCUS" }] }),
  component: StudiesPage,
});

function StudiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pomodoro" | "flashcards">("pomodoro");
  const [subjectName, setSubjectName] = useState("");
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("study_subjects").select("*")).data ?? [],
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("study_sessions").select("*").order("started_at", { ascending: false }).limit(10)).data ?? [],
  });

  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [running]);

  useEffect(() => {
    if (secs === 0 && running) {
      setRunning(false);
      supabase.from("study_sessions").insert({ user_id: user!.id, duration_minutes: 25 }).then(() => qc.invalidateQueries({ queryKey: ["sessions"] }));
      setSecs(25 * 60);
    }
  }, [secs, running, user, qc]);

  const addSubject = async () => {
    if (!subjectName.trim()) return;
    await supabase.from("study_subjects").insert({ user_id: user!.id, name: subjectName.trim() });
    setSubjectName(""); qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <AppShell title="Estudos" subtitle="Pomodoro · Matérias · Flashcards (SRS)"
      actions={
        <div className="flex gap-1 bg-surface border border-border-subtle rounded-lg p-1">
          <button onClick={() => setTab("pomodoro")} className={`px-3 h-8 text-xs font-mono uppercase rounded ${tab === "pomodoro" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pomodoro</button>
          <button onClick={() => setTab("flashcards")} className={`px-3 h-8 text-xs font-mono uppercase rounded ${tab === "flashcards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Flashcards</button>
        </div>
      }>
      {tab === "pomodoro" ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 bg-surface/40 border border-border-subtle rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute -right-20 -top-20 size-64 bg-primary/10 blur-[100px] rounded-full" />
            <p className="text-[11px] font-mono uppercase tracking-widest text-primary relative">Sessão Pomodoro</p>
            <p className="text-6xl md:text-7xl font-mono font-light tabular-nums mt-4 relative">{mm}:{ss}</p>
            <div className="flex justify-center gap-2 mt-6 relative">
              <button onClick={() => setRunning(!running)} className="h-10 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2">
                {running ? <><Pause className="size-4" />Pausar</> : <><Play className="size-4" />Iniciar</>}
              </button>
              <button onClick={() => { setRunning(false); setSecs(25 * 60); }} className="h-10 px-5 bg-white/5 border border-white/10 rounded-lg text-sm flex items-center gap-2"><RotateCcw className="size-4" />Resetar</button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="font-medium text-sm mb-4">Matérias</h3>
            <div className="flex gap-2 mb-4">
              <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Nova matéria"
                className="flex-1 h-9 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
              <button onClick={addSubject} className="size-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center"><Plus className="size-4" /></button>
            </div>
            <ul className="space-y-1">
              {subjects.map((s) => <li key={s.id} className="text-sm py-1.5 px-2 rounded hover:bg-white/5">{s.name}</li>)}
              {subjects.length === 0 && <li className="text-xs text-muted-foreground py-3 text-center">Nenhuma matéria.</li>}
            </ul>
          </div>

          <div className="col-span-12 bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="font-medium text-sm mb-4">Sessões recentes</h3>
            {sessions.length === 0 ? <p className="text-xs text-muted-foreground">Complete um Pomodoro para começar.</p>
              : <ul className="divide-y divide-border-subtle">
                {sessions.map((s) => (
                  <li key={s.id} className="flex justify-between py-2.5 text-sm">
                    <span>{new Date(s.started_at).toLocaleString("pt-BR")}</span>
                    <span className="font-mono text-primary">{s.duration_minutes}min</span>
                  </li>
                ))}
              </ul>}
          </div>
        </div>
      ) : (
        <Flashcards subjects={subjects} />
      )}
    </AppShell>
  );
}

function Flashcards({ subjects }: { subjects: Array<{ id: string; name: string }> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);

  const { data: cards = [] } = useQuery({
    queryKey: ["flashcards"],
    queryFn: async () => (await supabase.from("flashcards").select("*").order("next_review")).data ?? [],
  });

  const due = cards.filter((c) => new Date(c.next_review!) <= new Date());
  const current = due[idx];

  const create = async () => {
    if (!front.trim() || !back.trim()) return;
    await supabase.from("flashcards").insert({ user_id: user!.id, front: front.trim(), back: back.trim(), subject_id: subjectId || null });
    setFront(""); setBack(""); qc.invalidateQueries({ queryKey: ["flashcards"] });
  };

  const review = async (quality: 0 | 1 | 2 | 3) => {
    if (!current) return;
    // SM-2 simplified
    const ease = Math.max(1.3, (current.ease ?? 2.5) + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)));
    const days = quality === 0 ? 1 : quality === 1 ? 2 : quality === 2 ? 4 : Math.round(ease * 3);
    const next = new Date(); next.setDate(next.getDate() + days);
    await supabase.from("flashcards").update({ ease, next_review: next.toISOString().slice(0, 10) }).eq("id", current.id);
    setFlipped(false);
    qc.invalidateQueries({ queryKey: ["flashcards"] });
    if (idx >= due.length - 1) setIdx(0);
  };

  const remove = async (id: string) => {
    await supabase.from("flashcards").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  };

  const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const exportCsv = () => {
    if (!cards.length) { toast.info("Nada para exportar"); return; }
    const subjMap = new Map(subjects.map((s) => [s.id, s.name]));
    const rows = [["front", "back", "subject", "next_review", "ease"]];
    cards.forEach((c) => rows.push([
      c.front, c.back, c.subject_id ? subjMap.get(c.subject_id) ?? "" : "",
      c.next_review ?? "", String(c.ease ?? 2.5),
    ]));
    const csv = rows.map((r) => r.map((v) => escapeCsv(String(v))).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `flashcards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${cards.length} flashcards exportados`);
  };

  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = []; let row: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          row.push(cur); rows.push(row); row = []; cur = "";
        } else cur += ch;
      }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  };

  const importCsv = async (file: File) => {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    if (rows.length < 2) { toast.error("CSV vazio"); return; }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const iFront = header.indexOf("front"); const iBack = header.indexOf("back");
    const iSubj = header.indexOf("subject"); const iNext = header.indexOf("next_review"); const iEase = header.indexOf("ease");
    if (iFront < 0 || iBack < 0) { toast.error("Colunas obrigatórias: front, back"); return; }
    const subjByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));
    const inserts = rows.slice(1).map((r) => ({
      user_id: user!.id,
      front: r[iFront]?.trim() ?? "",
      back: r[iBack]?.trim() ?? "",
      subject_id: iSubj >= 0 && r[iSubj] ? subjByName.get(r[iSubj].trim().toLowerCase()) ?? null : null,
      next_review: iNext >= 0 && r[iNext] ? r[iNext].trim() : undefined,
      ease: iEase >= 0 && r[iEase] ? parseFloat(r[iEase]) || 2.5 : undefined,
    })).filter((c) => c.front && c.back);
    if (!inserts.length) { toast.error("Nenhuma linha válida"); return; }
    const { error } = await supabase.from("flashcards").insert(inserts);
    if (error) { toast.error("Falha: " + error.message); return; }
    toast.success(`${inserts.length} flashcards importados`);
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-7 bg-surface border border-border-subtle rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="size-4 text-primary" />
          <h3 className="font-medium text-sm">Revisão · {due.length} pendentes</h3>
        </div>
        {!current ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {cards.length === 0 ? "Crie seu primeiro flashcard ao lado." : "Tudo revisado por hoje. Volte amanhã."}
          </div>
        ) : (
          <>
            <button onClick={() => setFlipped(!flipped)}
              className="w-full min-h-[200px] bg-background border border-border-subtle rounded-xl p-8 text-center hover:border-primary/40 transition-colors">
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-3">{flipped ? "Resposta" : "Pergunta"} · clique para virar</p>
              <p className="text-lg">{flipped ? current.back : current.front}</p>
            </button>
            {flipped && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                <button onClick={() => review(0)} className="h-10 bg-destructive/15 text-destructive rounded-lg text-xs font-medium">Errei</button>
                <button onClick={() => review(1)} className="h-10 bg-orange-500/15 text-orange-400 rounded-lg text-xs font-medium">Difícil</button>
                <button onClick={() => review(2)} className="h-10 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-medium">OK</button>
                <button onClick={() => review(3)} className="h-10 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium">Fácil</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="col-span-12 lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-6 space-y-3">
        <h3 className="font-medium text-sm">Criar flashcard</h3>
        <input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Frente (pergunta)" className="w-full h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm" />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Verso (resposta)" className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-sm min-h-[80px]" />
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full h-10 bg-background border border-border-subtle rounded-lg px-3 text-sm">
          <option value="">Sem matéria</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={create} className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Plus className="size-4" />Adicionar</button>

        <div className="pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Todos ({cards.length})</p>
            <div className="flex gap-1">
              <button onClick={exportCsv} title="Exportar CSV" className="size-7 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center"><Download className="size-3.5" /></button>
              <label title="Importar CSV" className="size-7 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer">
                <Upload className="size-3.5" />
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs py-1 group">
                <span className="flex-1 truncate">{c.front}</span>
                <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
