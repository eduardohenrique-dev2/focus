import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseClient() {
  // No navegador o Vite usa VITE_*; no SSR usamos as variáveis sem prefixo.
  const serverEnv = typeof process !== "undefined" ? process.env : undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || serverEnv?.SUPABASE_URL;
  const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || serverEnv?.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      ...(!supabaseUrl ? ["VITE_SUPABASE_URL (ou SUPABASE_URL no servidor)"] : []),
      ...(!supabaseKey
        ? ["VITE_SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_PUBLISHABLE_KEY no servidor)"]
        : []),
    ];

    throw new Error(
      `Configuração do Supabase ausente: ${missing.join(", ")}. Copie .env.example para .env e preencha os valores.`,
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let supabaseClient: ReturnType<typeof createSupabaseClient> | undefined;

// Cliente criado sob demanda para funcionar tanto no navegador quanto no SSR.
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!supabaseClient) supabaseClient = createSupabaseClient();
    return Reflect.get(supabaseClient, prop, receiver);
  },
});
