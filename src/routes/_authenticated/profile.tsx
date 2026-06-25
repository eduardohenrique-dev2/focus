import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSaveStatus, useDebounced } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — FOCUS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, set } = useAutoSaveStatus();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [tz, setTz] = useState("America/Sao_Paulo");
  useEffect(() => { if (profile) { setName(profile.display_name ?? ""); setTz(profile.timezone ?? "America/Sao_Paulo"); } }, [profile?.id]);

  const dName = useDebounced(name, 500);
  const dTz = useDebounced(tz, 500);

  useEffect(() => {
    if (!profile) return;
    if (dName === (profile.display_name ?? "") && dTz === (profile.timezone ?? "")) return;
    (async () => {
      set("saving");
      const { error } = await supabase.from("profiles").update({ display_name: dName, timezone: dTz }).eq("user_id", user!.id);
      if (error) set("error"); else { set("saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
    })();
  }, [dName, dTz]);

  return (
    <AppShell title="Perfil" subtitle="Seus dados pessoais" status={status}>
      <div className="max-w-xl bg-surface border border-border-subtle rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Email</label>
          <input disabled value={user?.email ?? ""} className="mt-1.5 w-full bg-background/50 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-muted-foreground" />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Fuso horário</label>
          <input value={tz} onChange={(e) => setTz(e.target.value)}
            className="mt-1.5 w-full bg-background border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/40" />
        </div>
      </div>
    </AppShell>
  );
}
