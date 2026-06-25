import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { FloatingAI } from "@/components/floating-ai";
import { CommandPalette } from "@/components/command-palette";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <FloatingAI />
      <CommandPalette />
    </AuthProvider>
  );
}
