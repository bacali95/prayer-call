import { NavLink, Outlet } from "react-router";
import { CalendarDays, Landmark, Music2, Settings, Speaker, Tv, Wrench, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useVersion } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: "/", label: "Today", icon: CalendarDays, end: true },
  { to: "/mosque", label: "Mosque", icon: Landmark },
  { to: "/speaker", label: "Speaker", icon: Speaker },
  { to: "/adhan", label: "Adhan", icon: Music2 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/system", label: "System", icon: Wrench },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.jpg" alt="" width={40} height={40} className="size-10 rounded-lg object-cover ring-1 ring-border" />
      <div className="leading-tight">
        <div className="font-display text-lg font-medium tracking-tight whitespace-nowrap">Prayer Call</div>
        <div className="hidden text-xs text-muted-foreground md:block">Adhan on your speaker</div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { data: version } = useVersion();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-sidebar md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:p-4">
        <div className="px-2 py-3">
          <Brand />
        </div>
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brass-soft text-brass"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
          <a
            href="/screensaver"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Tv className="size-[18px]" aria-hidden />
            Screensaver
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          <ThemeToggle />
          <p className="px-3 py-1 text-xs text-muted-foreground num">
            {version ? `Version ${version.version}` : " "}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Brand />
          <div className="w-32 shrink-0">
            <ThemeToggle compact />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-brass" : "text-muted-foreground",
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
