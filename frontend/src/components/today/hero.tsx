import { Link } from "react-router";
import { MapPin, Sunrise } from "lucide-react";
import { PRAYERS } from "@/lib/prayers";
import { formatCountdown, formatGregorian, formatHijri, type NextPrayer } from "@/lib/schedule";
import type { Config } from "@/lib/types";

export function Hero({ config, next, now }: { config: Config; next: NextPrayer | null; now: Date }) {
  const meta = next ? PRAYERS[next.key] : null;
  const mosque = config.mosque?.name;
  return (
    <section
      aria-label="Next prayer"
      className="pattern-star relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-(--hero-from) to-(--hero-to) p-6 text-(--hero-foreground) shadow-lg md:p-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-sm text-(--hero-muted)">
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden />
          {mosque ? <span lang={/[؀-ۿ]/.test(mosque) ? "ar" : undefined}>{mosque}</span> : "No mosque selected"}
        </p>
        <p className="text-right">
          <span className="block">{formatGregorian(now)}</span>
          <span className="block">
            {formatHijri(now, "en")}
          </span>
          <span lang="ar" dir="rtl" className="block">
            {formatHijri(now, "ar")}
          </span>
        </p>
      </div>

      {next && meta ? (
        <div className="mt-8 grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-(--hero-brass) uppercase">
              <Sunrise className="size-4" aria-hidden />
              {next.tomorrow ? "Tomorrow" : "Next prayer"}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <h2 className="font-display text-5xl font-medium tracking-tight md:text-7xl">{meta.en}</h2>
              <span lang="ar" dir="rtl" className="text-4xl text-(--hero-brass) md:text-5xl">
                {meta.ar}
              </span>
            </div>
            <p className="mt-2 text-(--hero-muted)">
              Adhan at <span className="font-display-num text-xl text-(--hero-foreground)">{next.time}</span>
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-xs tracking-[0.2em] text-(--hero-muted) uppercase">Time remaining</p>
            <p
              role="timer"
              aria-label={`Time until ${meta.en}`}
              className="font-display-num text-5xl font-light text-(--hero-brass) md:text-6xl"
            >
              {formatCountdown(next.date.getTime() - now.getTime())}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="font-display text-4xl font-medium tracking-tight">No prayer times yet</h2>
          <p className="mt-2 max-w-prose text-(--hero-muted)">
            Choose your mosque and the day's times will appear here.{" "}
            <Link to="/mosque" className="text-(--hero-brass) underline underline-offset-4">
              Select a mosque
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
