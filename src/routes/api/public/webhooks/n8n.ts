import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { verifyPayloadSignature } from "@/lib/automation/security";

export const Route = createFileRoute("/api/public/webhooks/n8n")({
  server: {
    handlers: {
      POST: async () => {
        const request = getRequest();
        if (!request) {
          return Response.json({ ok: false, error: "Request unavailable" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rawBody = await request.text();
        const secret = request.headers.get("x-focus-webhook-secret");
        const signature = request.headers.get("x-focus-signature");
        const origin = request.headers.get("origin") ?? request.headers.get("x-forwarded-host") ?? "";

        if (!secret || !signature) {
          return Response.json({ ok: false, error: "Missing webhook secret or signature" }, { status: 401 });
        }

        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("automation_n8n_connections")
          .select("*")
          .eq("webhook_secret", secret)
          .maybeSingle();

        if (connectionError || !connection) {
          return Response.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
        }

        const validSignature = await verifyPayloadSignature(rawBody, connection.webhook_secret, signature);
        if (!validSignature) {
          return Response.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
        }

        if (connection.allowed_origins?.length && !origin) {
          return Response.json({ ok: false, error: "Origin header required" }, { status: 403 });
        }

        if (connection.allowed_origins?.length && origin) {
          const allowed = connection.allowed_origins.some((allowedOrigin: string) => origin.includes(allowedOrigin));
          if (!allowed) {
            return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
          }
        }

        let body: any;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
        }

        if (!body || typeof body.type !== "string" || typeof body.source !== "string") {
          return Response.json({ ok: false, error: "Invalid webhook format" }, { status: 400 });
        }

        const started = Date.now();
        const { data: event, error: eventError } = await supabaseAdmin
          .from("automation_events")
          .insert({
            user_id: connection.user_id,
            type: body.type,
            source: `n8n.${body.source}`,
            payload: body.payload ?? {},
            status: "processed",
            occurred_at: body.occurred_at ?? new Date().toISOString(),
            processed_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (eventError || !event) {
          return Response.json({ ok: false, error: eventError?.message ?? "Failed to register event" }, { status: 500 });
        }

        await supabaseAdmin.from("automation_execution_logs").insert({
          user_id: connection.user_id,
          event_id: event.id,
          status: "success",
          destination: "focus",
          duration_ms: Date.now() - started,
          payload: body.payload ?? {},
          request_payload: body,
          response_payload: { accepted: true, event_id: event.id },
          result: {
            received_from: "n8n",
            action: body.action ?? "event_registered",
            dry_run: true,
          },
          finished_at: new Date().toISOString(),
        });

        await supabaseAdmin
          .from("automation_n8n_connections")
          .update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null })
          .eq("id", connection.id);

        return Response.json({ ok: true, event_id: event.id }, { status: 202 });
      },
    },
  },
});
