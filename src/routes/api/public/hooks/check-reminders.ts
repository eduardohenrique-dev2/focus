import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/check-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        // Find reminders due that are still pending
        const { data: due, error } = await supabaseAdmin
          .from("reminders")
          .select("id, user_id, title, description, remind_at")
          .eq("status", "pending")
          .lte("remind_at", now);

        if (error) {
          console.error("[check-reminders]", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        if (!due || due.length === 0) {
          return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
        }

        // Create notifications + mark reminders as triggered
        const notifications = due.map((r) => ({
          user_id: r.user_id,
          title: `⏰ ${r.title}`,
          body: r.description ?? `Lembrete agendado para ${new Date(r.remind_at).toLocaleString("pt-BR")}`,
          type: "info" as const,
        }));

        const { error: nErr } = await supabaseAdmin.from("notifications").insert(notifications);
        if (nErr) console.error("[check-reminders] notif insert", nErr);

        const ids = due.map((r) => r.id);
        await supabaseAdmin.from("reminders").update({ status: "done" }).in("id", ids);

        return new Response(JSON.stringify({ ok: true, processed: due.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
