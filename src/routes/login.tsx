import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LoginMode = "signin" | "signup" | "reset" | "updatePassword";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar - FOCUS" },
      { name: "description", content: "Acesse seu painel pessoal FOCUS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session && !location.href.includes("reset=1")) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      setMode("updatePassword");
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Conta criada! Bem-vindo ao FOCUS.");
          navigate({ to: "/" });
        } else {
          toast.success("Conta criada! Agora entre com seu email e senha.");
          setMode("signin");
        }
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?reset=1`,
        });
        if (error) throw error;
        toast.success("Enviamos o link para redefinir sua senha.");
        setMode("signin");
      } else if (mode === "updatePassword") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha redefinida com sucesso!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const titleByMode: Record<LoginMode, string> = {
    signin: "Bem-vindo de volta",
    signup: "Crie sua conta",
    reset: "Redefinir senha",
    updatePassword: "Nova senha",
  };

  const descriptionByMode: Record<LoginMode, string> = {
    signin: "Acesse seu painel pessoal.",
    signup: "Comece a organizar sua vida em minutos.",
    reset: "Informe seu email para receber o link de redefinicao.",
    updatePassword: "Digite a nova senha para finalizar a redefinicao.",
  };

  const submitTextByMode: Record<LoginMode, string> = {
    signin: "Entrar",
    signup: "Criar conta",
    reset: "Enviar link",
    updatePassword: "Salvar nova senha",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 size-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-10">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold focus-glow">F</div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">FOCUS</h1>
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Seu OS pessoal</p>
          </div>
        </div>

        <h2 className="text-2xl font-light tracking-tight mb-1">{titleByMode[mode]}</h2>
        <p className="text-sm text-muted-foreground mb-8">{descriptionByMode[mode]}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full h-11 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          )}
          {mode !== "updatePassword" && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full h-11 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          )}
          {mode !== "reset" && (
            <>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "updatePassword" ? "Nova senha" : "Senha"}
                required
                minLength={6}
                className="w-full h-11 bg-surface border border-border-subtle rounded-lg px-3.5 text-sm outline-none focus:border-primary/50 transition-colors"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Mostrar senha
              </label>
            </>
          )}
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-xs text-primary hover:brightness-110 transition-colors"
            >
              Esqueci minha senha
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary hover:brightness-110 text-primary-foreground rounded-lg text-sm font-medium transition-all disabled:opacity-50 focus-glow"
          >
            {loading ? "..." : submitTextByMode[mode]}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs text-muted-foreground hover:text-foreground mt-6 w-full text-center transition-colors"
        >
          {mode === "signin" ? "Nao tem conta? Criar uma" : "Ja tem conta? Entrar"}
        </button>
      </motion.div>
    </div>
  );
}
