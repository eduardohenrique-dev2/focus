import { useState, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { Check, CloudOff, Loader2, Menu, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "./notification-bell";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Sincronizando...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-mono text-primary">
        <Check className="size-3" /> Salvo automaticamente
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-mono text-destructive">
        <CloudOff className="size-3" /> Falha ao salvar
      </span>
    );
  }
  return null;
}

export function AppShell({
  title,
  subtitle,
  children,
  status,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  status?: SaveStatus;
  actions?: ReactNode;
}) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Eduardo";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={setMobileMenuOpen}
        compact={sidebarCompact}
        onCompactChange={setSidebarCompact}
      />

      <main
        className={`min-h-screen transition-[padding] duration-200 ease-out ${
          sidebarCompact ? "lg:pl-[72px]" : "lg:pl-[240px] min-[1440px]:pl-[280px]"
        }`}
      >
        <div className="min-h-screen px-4 py-4 sm:px-5 md:px-7 lg:px-8 min-[1440px]:px-10">
          <header className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border-subtle bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5 md:-mx-7 md:px-7 lg:static lg:mx-0 lg:mb-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-4 lg:backdrop-blur-0">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                className="flex h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface/70 px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:hidden"
              >
                <Menu className="size-4" />
                <span className="hidden min-[420px]:inline">Menu</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h1 className="min-w-0 truncate text-xl font-light tracking-tight text-foreground sm:text-2xl md:text-3xl">
                    {title}
                  </h1>
                  {status && <SaveIndicator status={status} />}
                </div>
                {subtitle && (
                  <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-tight text-muted-foreground md:text-xs">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
                <div className="hidden min-w-0 items-center gap-2 md:flex">{actions}</div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                  aria-label="Buscar"
                  className="hidden h-10 min-w-[136px] items-center gap-2 rounded-xl border border-border-subtle bg-surface/70 px-3 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:flex lg:min-w-[170px]"
                >
                  <Search className="size-4 shrink-0" />
                  <span className="truncate text-xs">Buscar</span>
                  <kbd className="ml-auto hidden rounded border border-border-subtle px-1 py-0.5 font-mono text-[10px] xl:inline">
                    Ctrl K
                  </kbd>
                </button>
                <NotificationBell />
                <div
                  aria-label={`Perfil de ${name}`}
                  className="size-10 shrink-0 rounded-full border border-primary/20 bg-primary/15 text-primary flex items-center justify-center text-xs font-medium"
                >
                  {initial}
                </div>
              </div>

              {actions && <div className="flex w-full items-center gap-2 md:hidden">{actions}</div>}
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1800px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
