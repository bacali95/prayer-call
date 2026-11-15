import { useEffect, useState } from "react";
import { useConfig, useSlides } from "@/hooks/use-api";
import { useNow } from "@/hooks/use-now";
import { PRAYERS } from "@/lib/prayers";
import {
  buildTimeline,
  formatCountdown,
  formatDuration,
  formatGregorian,
  formatHijri,
  getNextPrayer,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import "./screensaver.css";

const SLIDE_MS = 16_000;
const MAX_SLIDES = 12;

export default function ScreensaverPage() {
  const config = useConfig({ refetchInterval: 60_000 });
  const slidesQuery = useSlides();
  const now = useNow(1000);
  const [tick, setTick] = useState(0);

  const slides = (slidesQuery.data ?? []).slice(0, MAX_SLIDES);
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);
  const active = slides.length ? tick % slides.length : -1;

  const times = config.data?.prayer_times;
  const next = getNextPrayer(times, now);
  const timeline = buildTimeline(times, now);
  const meta = next ? PRAYERS[next.key] : null;
  const untilNext = next ? next.date.getTime() - now.getTime() : 0;
  const mosque = config.data?.mosque?.name;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <main
      aria-label="Prayer clock"
      className="ss-root pattern-star fixed inset-0 overflow-hidden font-sans"
      style={{ ["--pattern" as string]: "oklch(0.86 0.12 85)" }}
    >
      <div aria-hidden className="absolute inset-0">
        {slides.map((url, i) => (
          <div
            key={url}
            className={cn("ss-slide absolute inset-0", i === active && "is-active")}
            style={{ backgroundImage: `url("${url}")` }}
          />
        ))}
        <div className="ss-shade absolute inset-0" />
      </div>

      <div
        className="relative flex h-full flex-col justify-between"
        style={{ padding: "var(--pad)", gap: "clamp(12px, 2.5vmin, 40px)" }}
      >
        <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2" style={{ fontSize: "clamp(0.9rem, 2.4vmin, 1.6rem)" }}>
          <p className="min-w-0 text-(--ss-muted)">
            {mosque ? <span lang={/[؀-ۿ]/.test(mosque) ? "ar" : undefined}>{mosque}</span> : "Prayer Call"}
          </p>
          <div className="text-right">
            <p>{formatGregorian(now)}</p>
            <p className="text-(--ss-muted)">{formatHijri(now, "en")}</p>
            <p lang="ar" dir="rtl" className="text-right text-(--ss-brass)" style={{ fontSize: "1.15em" }}>
              {formatHijri(now, "ar")}
            </p>
          </div>
        </header>

        <section aria-label="Current time" className="flex flex-col items-center text-center">
          <p className="ss-clock" aria-label={`${hh}:${mm}`}>
            {hh}:{mm}
            <span aria-hidden className="ms-[0.08em] align-top text-[0.28em] text-(--ss-brass)">
              {ss}
            </span>
          </p>
        </section>

        <section aria-label="Next prayer" className="ss-card w-full" style={{ padding: "clamp(12px, 2.5vmin, 32px)", marginTop: "clamp(32px, 14vmin, 220px)" }}>
          {next && meta ? (
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
              <div>
                <p className="tracking-[0.2em] text-(--ss-brass) uppercase" style={{ fontSize: "clamp(0.65rem, 1.5vmin, 0.95rem)" }}>
                  {next.tomorrow ? "Tomorrow" : "Next prayer"}
                </p>
                <p className="flex flex-wrap items-baseline gap-x-[0.5em]" style={{ fontSize: "clamp(1.6rem, 6vmin, 4.25rem)" }}>
                  <span className="font-display leading-tight font-medium">{meta.en}</span>
                  <span lang="ar" dir="rtl" className="text-(--ss-brass)">
                    {meta.ar}
                  </span>
                </p>
                <p className="text-(--ss-muted)" style={{ fontSize: "clamp(0.8rem, 2vmin, 1.25rem)" }}>
                  Adhan at <span className="font-display-num text-(--ss-fg)">{next.time}</span>
                  {" · "}in {formatDuration(untilNext)}
                </p>
              </div>
              <p
                className="font-display-num leading-none font-light text-(--ss-brass)"
                style={{ fontSize: "clamp(2rem, 8.5vmin, 6rem)" }}
                aria-label={`${formatDuration(untilNext)} until ${meta.en}`}
              >
                {formatCountdown(untilNext)}
              </p>
            </div>
          ) : (
            <p className="text-center text-(--ss-muted)" style={{ fontSize: "clamp(1rem, 3vmin, 2rem)" }}>
              {config.isError ? "Prayer times are unavailable right now." : config.isPending ? "Loading prayer times…" : "Choose a mosque to see prayer times."}
            </p>
          )}
        </section>

        <ol aria-label="Today's prayer times" className="ss-rail">
          {timeline.length === 0
            ? null
            : timeline.map((e) => {
                const m = PRAYERS[e.key];
                const isNext = e.status === "next";
                return (
                  <li
                    key={e.key}
                    aria-current={isNext ? "time" : undefined}
                    className={cn(
                      "ss-card text-center",
                      isNext && "border-(--ss-brass) bg-[oklch(0.3_0.06_80/0.55)]",
                      e.status === "passed" && "opacity-70",
                      e.key === "shuruq" && "opacity-80",
                    )}
                    style={{ padding: "clamp(8px, 1.8vmin, 22px) clamp(4px, 1vmin, 12px)" }}
                  >
                    <p style={{ fontSize: "clamp(0.85rem, 2.4vmin, 1.6rem)" }}>
                      <span className={isNext ? "text-(--ss-brass)" : "text-(--ss-muted)"}>{m.en}</span>
                      <span lang="ar" dir="rtl" className="ml-2 text-(--ss-muted)">
                        {m.ar}
                      </span>
                    </p>
                    <p
                      className={cn("font-display-num", isNext && "text-(--ss-brass)")}
                      style={{ fontSize: "clamp(1.4rem, 5vmin, 3.3rem)" }}
                    >
                      {e.time}
                    </p>
                  </li>
                );
              })}
        </ol>
      </div>
    </main>
  );
}
