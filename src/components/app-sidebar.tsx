import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell,
  Calendar,
  CheckSquare,
  ChevronLeft,
  Clock,
  Kanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  User as UserIcon,
  Wallet,
  X,
  GraduationCap,
  Zap,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;
type NavItem = {
  to?: string;
  label: string;
  icon: NavIcon;
  action?: "ai" | "logout";
};
type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Sistema",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/tasks", label: "Tarefas", icon: CheckSquare },
      { to: "/calendar", label: "Calendario", icon: Calendar },
      { to: "/notes", label: "Notas", icon: StickyNote },
      { to: "/projects", label: "Projetos", icon: Kanban },
    ],
  },
  {
    title: "Personal OS",
    items: [
      { to: "/goals", label: "Metas", icon: Target },
      { to: "/habits", label: "Habitos", icon: Activity },
      { to: "/studies", label: "Estudos", icon: GraduationCap },
      { to: "/finance", label: "Financas", icon: Wallet },
      { to: "/reminders", label: "Lembretes", icon: Clock },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { label: "FOCUS AI", icon: Sparkles, action: "ai" },
      { to: "/automations", label: "Automacoes", icon: Zap },
      { to: "/settings", label: "Configuracoes", icon: Settings },
    ],
  },
  {
    title: "Conta",
    items: [
      { to: "/profile", label: "Perfil", icon: UserIcon },
      { label: "Logout", icon: LogOut, action: "logout" },
    ],
  },
];

function isActive(pathname: string, to?: string) {
  if (!to) return false;
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function SidebarNavItem({
  item,
  active,
  compact,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
  onNavigate: (item: NavItem) => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icon className="size-4 shrink-0" strokeWidth={1.9} />
      <span className={`min-w-0 truncate transition-opacity duration-200 ${compact ? "lg:opacity-0" : "opacity-100"}`}>
        {item.label}
      </span>
    </>
  );

  const className = `group/nav relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm outline-none transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
    active
      ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)]"
      : "text-muted-foreground hover:bg-surface/80 hover:text-foreground"
  } ${compact ? "lg:w-10 lg:justify-center lg:px-0" : ""}`;

  if (item.to) {
    return (
      <Link to={item.to} aria-label={item.label} title={compact ? item.label : undefined} className={className} onClick={() => onNavigate(item)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={item.label} title={compact ? item.label : undefined} className={className} onClick={() => onNavigate(item)}>
      {content}
    </button>
  );
}

function SidebarContent({
  compact,
  onToggleCompact,
  onRequestClose,
}: {
  compact: boolean;
  onToggleCompact?: () => void;
  onRequestClose?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Eduardo";
  const initial = name.charAt(0).toUpperCase();

  const handleNavigate = async (item: NavItem) => {
    if (item.action === "ai") {
      window.dispatchEvent(new CustomEvent("focus:open-ai"));
    }
    if (item.action === "logout") {
      await signOut();
      toast.success("Ate logo, Eduardo.");
      navigate({ to: "/login" });
    }
    onRequestClose?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className={`flex h-12 items-center ${compact ? "lg:justify-center" : "justify-between"} gap-2 px-1`}>
        <Link to="/" aria-label="Ir para o Dashboard" onClick={onRequestClose} className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <div className="size-8 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold focus-glow">
            F
          </div>
          <div className={`min-w-0 transition-opacity duration-200 ${compact ? "lg:hidden" : ""}`}>
            <p className="text-sm font-semibold tracking-tight leading-none">FOCUS</p>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Life OS</p>
          </div>
        </Link>
        {onToggleCompact && (
          <button
            type="button"
            aria-label={compact ? "Expandir sidebar" : "Recolher sidebar"}
            onClick={onToggleCompact}
            className={`hidden lg:flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              compact ? "lg:hidden" : ""
            }`}
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      <nav aria-label="Navegacao principal" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
        <div className="space-y-4 pb-3">
          {navGroups.map((group) => (
            <section key={group.title} aria-label={group.title} className="space-y-1">
              <p className={`px-3 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70 transition-opacity duration-200 ${compact ? "lg:hidden" : ""}`}>
                {group.title}
              </p>
              <div className={`space-y-1 ${compact ? "lg:flex lg:flex-col lg:items-center" : ""}`}>
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.to ?? item.action ?? item.label}
                    item={item}
                    active={isActive(pathname, item.to)}
                    compact={compact}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className={`shrink-0 rounded-xl border border-border-subtle bg-surface/45 p-2 ${compact ? "lg:flex lg:justify-center lg:border-transparent lg:bg-transparent lg:p-0" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-9 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-medium ring-1 ring-primary/20">
            {initial}
          </div>
          <div className={`min-w-0 flex-1 transition-opacity duration-200 ${compact ? "lg:hidden" : ""}`}>
            <p className="truncate text-xs font-medium">{name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  mobileOpen,
  onMobileOpenChange,
  compact,
  onCompactChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const effectiveCompact = compact && !hovered;

  return (
    <>
      <aside
        className={`group/sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-border-subtle bg-background/95 backdrop-blur-xl lg:block ${
          compact ? "w-[72px]" : "w-[240px] min-[1440px]:w-[280px]"
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-compact={effectiveCompact}
      >
        <div
          className={`h-full will-change-transform ${
            compact
              ? effectiveCompact
                ? "w-[72px] bg-background/95"
                : "w-[240px] min-[1440px]:w-[280px] bg-background/95 shadow-2xl shadow-black/20"
              : "w-[240px] min-[1440px]:w-[280px]"
          }`}
        >
          <SidebarContent compact={effectiveCompact} onToggleCompact={() => onCompactChange(!compact)} />
        </div>
      </aside>

      {compact && (
        <button
          type="button"
          aria-label="Expandir sidebar"
          onClick={() => onCompactChange(false)}
          className="fixed left-3 top-4 z-40 hidden size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:flex"
        >
          <ChevronLeft className="size-4 rotate-180" />
        </button>
      )}

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Fechar menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm lg:hidden"
              onClick={() => onMobileOpenChange(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegacao"
              className="fixed inset-y-0 left-0 z-50 w-[min(88vw,360px)] border-r border-border-subtle bg-background shadow-2xl lg:hidden"
            >
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => onMobileOpenChange(false)}
                className="absolute right-3 top-3 z-10 size-9 rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X className="mx-auto size-4" />
              </button>
              <SidebarContent compact={false} onRequestClose={() => onMobileOpenChange(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
