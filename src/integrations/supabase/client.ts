import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLocalClient } from "./local-client";
import type { Database } from "./types";

type FocusClient = SupabaseClient<Database>;

function getConfiguration() {
  const serverEnv = typeof process !== "undefined" ? process.env : undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || serverEnv?.SUPABASE_URL;
  const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || serverEnv?.SUPABASE_PUBLISHABLE_KEY;
  const requestedBackend = String(
    import.meta.env.VITE_DATA_BACKEND || serverEnv?.DATA_BACKEND || "auto",
  ).toLowerCase();

  return { supabaseUrl, supabaseKey, requestedBackend };
}

function createFocusClient(): FocusClient {
  const { supabaseUrl, supabaseKey, requestedBackend } = getConfiguration();
  const hasSupabase = Boolean(supabaseUrl && supabaseKey);
  const useLocal = requestedBackend === "local" || (requestedBackend === "auto" && !hasSupabase);

  if (useLocal) {
    return createLocalClient();
  }

  if (!hasSupabase) {
    throw new Error(
      "O modo Supabase foi solicitado, mas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY não foram configurados. Use VITE_DATA_BACKEND=local ou configure o Supabase.",
    );
  }

  return createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getDataBackend(): "local" | "supabase" {
  const { supabaseUrl, supabaseKey, requestedBackend } = getConfiguration();
  if (requestedBackend === "local") return "local";
  if (requestedBackend === "supabase") return "supabase";
  return supabaseUrl && supabaseKey ? "supabase" : "local";
}

let focusClient: FocusClient | undefined;

// Um único cliente para as telas. Sem .env o FOCUS usa banco local automaticamente.
export const supabase = new Proxy({} as FocusClient, {
  get(_, prop, receiver) {
    if (!focusClient) focusClient = createFocusClient();
    return Reflect.get(focusClient, prop, receiver);
  },
});
