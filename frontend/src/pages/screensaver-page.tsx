import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PrayerTimes } from "../types";
import "./screensaver-page.css";

// ── constants ─────────────────────────────────────────────────────────────────

const FALLBACK_SLIDES = [
  "https://images.unsplash.com/photo-1575101261474-5cb5653bb416",
];

const PIP_COUNT = 5;

function msUntilTopOfHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

const PRAYER_DEFS = [
  { key: "fajr", en: "Fajr", ar: "الفجر", passive: false },
  { key: "shuruq", en: "Shuruq", ar: "الشروق", passive: true },
  { key: "dhuhr", en: "Dhuhr", ar: "الظهر", passive: false },
  { key: "asr", en: "Asr", ar: "العصر", passive: false },
  { key: "maghrib", en: "Maghrib", ar: "المغرب", passive: false },
  { key: "isha", en: "Isha", ar: "العشاء", passive: false },
];

// ── font shorthands ───────────────────────────────────────────────────────────

const OUTFIT: React.CSSProperties = {
  fontFamily: '"Outfit", system-ui, sans-serif',
};
const CORMORANT: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontStyle: "italic",
};
const AMIRI: React.CSSProperties = { fontFamily: '"Amiri", serif' };
const RTL: React.CSSProperties = { direction: "rtl" };

// ── SVG glyphs ────────────────────────────────────────────────────────────────

const FajrGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M17 4a5 5 0 1 0 3 9 7 7 0 1 1-3-9z" />
  </svg>
);
const ShuruqGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-full h-full"
  >
    <path d="M3 18h18M7 18a5 5 0 1 1 10 0M12 4v3M5 7l2 2M19 7l-2 2" />
  </svg>
);
const DhuhrGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-full h-full"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
);
const AsrGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="w-full h-full"
  >
    <circle cx="12" cy="14" r="4" />
    <path d="M3 18h18M7 6l2 2M17 6l-2 2" />
  </svg>
);
const MaghribGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-full h-full"
  >
    <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 13v-3M9 12l3 3 3-3" />
  </svg>
);
const IshaGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const GLYPHS: Record<string, () => React.ReactElement> = {
  fajr: FajrGlyph,
  shuruq: ShuruqGlyph,
  dhuhr: DhuhrGlyph,
  asr: AsrGlyph,
  maghrib: MaghribGlyph,
  isha: IshaGlyph,
};

// ── helpers ───────────────────────────────────────────────────────────────────

type PrayerTimeVal = string | { [key: string | number]: string };

function extractTime(val: PrayerTimeVal | undefined): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  const today = new Date().getDate();
  return (
    (val as Record<string | number, string>)[today] ||
    (val as Record<string | number, string>)[String(today)] ||
    Object.values(val)[0] ||
    null
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function fmtDuration(mins: number) {
  return `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;
}

function getHijriDate(date: Date) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      calendar: "islamic",
      day: "numeric",
      month: "long",
      year: "numeric",
    } as Intl.DateTimeFormatOptions).format(date);
  } catch {
    return "";
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ScreensaverPage() {
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
    refetchInterval: 60_000,
  });

  // slides — fetched via backend (key hidden server-side), fallback to static set
  const { data: slides, refetch: refetchSlides } = useQuery({
    queryKey: ["unsplash-slides"],
    queryFn: api.getScreensaverSlides,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const activeSlides = slides ?? FALLBACK_SLIDES;

  // stable ref so the hourly timeout never captures a stale refetch fn
  const refetchRef = useRef(refetchSlides);
  useEffect(() => {
    refetchRef.current = refetchSlides;
  }, [refetchSlides]);

  const [canvas, setCanvas] = useState({ scale: 1, h: 1000 });
  const [rawSlide, setRawSlide] = useState(0);
  const [pipEpoch, setPipEpoch] = useState(0);
  const [now, setNow] = useState(new Date());

  // width fixed at 1600; height derived from actual viewport ratio → fills any screen
  useEffect(() => {
    const compute = () => {
      const scale = window.innerWidth / 1600;
      const h = Math.round(window.innerHeight / scale);
      setCanvas({ scale, h });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // derived carousel position
  const slideIdx = activeSlides.length > 0 ? rawSlide % activeSlides.length : 0;
  const activePip = slideIdx % PIP_COUNT;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRawSlide((i) => i + 1);
      setPipEpoch((k) => k + 1);
    }, 16000);
    return () => clearInterval(id);
  }, []);

  // refetch at top of every hour
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        refetchRef.current();
        schedule();
      }, msUntilTopOfHour());
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // ── prayer logic ─────────────────────────────────────────────────────────

  const rawTimes: PrayerTimes = config?.prayer_times ?? {};

  const prayers = PRAYER_DEFS.map((def) => ({
    ...def,
    time: extractTime(rawTimes[def.key] as PrayerTimeVal | undefined),
  })).filter((p) => p.time !== null) as ((typeof PRAYER_DEFS)[0] & {
    time: string;
  })[];

  const activePrayers = prayers.filter((p) => !p.passive);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let nextIdx = activePrayers.findIndex((p) => toMinutes(p.time) > nowMin);
  if (nextIdx === -1) nextIdx = 0;

  const nextPrayer = activePrayers[nextIdx] ?? null;
  const afterPrayer =
    activePrayers[(nextIdx + 1) % activePrayers.length] ?? null;

  const isRowActive = (key: string) => nextPrayer?.key === key;
  const isRowPassed = (key: string, time: string) =>
    nextPrayer?.key !== key && toMinutes(time) <= nowMin;

  let countdown = "00:00:00";
  let tillAfterStr = "";
  if (nextPrayer) {
    const [nh, nm] = nextPrayer.time.split(":").map(Number);
    const nextDate = new Date(now);
    nextDate.setHours(nh, nm, 0, 0);
    if (nextDate <= now) nextDate.setDate(nextDate.getDate() + 1);
    countdown = fmtCountdown(nextDate.getTime() - now.getTime());

    if (afterPrayer) {
      const [ah, am] = afterPrayer.time.split(":").map(Number);
      const afterDate = new Date(nextDate);
      afterDate.setHours(ah, am, 0, 0);
      if (afterDate <= nextDate) afterDate.setDate(afterDate.getDate() + 1);
      tillAfterStr = fmtDuration(
        Math.floor((afterDate.getTime() - nextDate.getTime()) / 60000),
      );
    }
  }

  // ── display strings ───────────────────────────────────────────────────────

  const gregorianStr = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const hijriStr = getHijriDate(now);

  const dayStr = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(now);

  const mosqueName = config?.mosque?.name ?? "";

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="relative overflow-hidden bg-[#100e0a] text-[#f5efe2] antialiased [text-rendering:optimizeLegibility]"
        style={{
          ...OUTFIT,
          width: 1600,
          height: canvas.h,
          transform: `scale(${canvas.scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* background carousel */}
        <div className="absolute inset-0">
          {activeSlides.map((url, i) => (
            <div
              key={url}
              className={`ss-slide absolute inset-0 bg-cover bg-center${i === slideIdx ? " is-active" : ""}`}
              style={{ backgroundImage: `url("${url}")` }}
            />
          ))}
        </div>

        {/* vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg,rgba(8,7,5,.55) 0%,rgba(8,7,5,0) 22%,rgba(8,7,5,0) 60%,rgba(8,7,5,.78) 100%)," +
              "linear-gradient(90deg,rgba(8,7,5,.55) 0%,rgba(8,7,5,0) 35%,rgba(8,7,5,0) 65%,rgba(8,7,5,.45) 100%)," +
              "radial-gradient(120% 80% at 50% 60%,rgba(0,0,0,0) 40%,rgba(0,0,0,.35) 100%)",
          }}
        />

        {/* geometric pattern left edge */}
        <div
          className="absolute left-0 top-0 w-[280px] h-full pointer-events-none opacity-[.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='%23f5efe2' stroke-width='0.7'><path d='M40 4 L52 16 L52 32 L40 44 L28 32 L28 16 Z'/><path d='M40 36 L52 48 L52 64 L40 76 L28 64 L28 48 Z'/><path d='M0 20 L8 28 L8 44 L0 52'/><path d='M80 20 L72 28 L72 44 L80 52'/></g></svg>\")",
            backgroundSize: "80px 80px",
          }}
        />

        {/* film grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[.18] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.85  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* ── top bar ── */}
        <div className="absolute top-14 left-16 right-16 flex justify-between items-start">
          {/* clock + dates */}
          <div className="flex flex-col gap-2">
            <div
              className="font-extralight text-[132px] leading-[.92] tracking-[-0.04em] tabular-nums flex items-baseline gap-1.5 [text-shadow:0_4px_40px_rgba(0,0,0,.45)]"
              style={OUTFIT}
            >
              <span>{pad(now.getHours())}</span>
              <span>:</span>
              <span>{pad(now.getMinutes())}</span>
              <span className="text-[44px] font-light text-[#f5efe2]/62 ml-3.5 tracking-[-0.02em]">
                {pad(now.getSeconds())}
              </span>
            </div>

            <div className="flex gap-7 items-center mt-1.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] tracking-[0.22em] uppercase text-[#f5efe2]/38 font-medium">
                  Gregorian
                </span>
                <span className="text-[22px] text-[#f5efe2] font-light tracking-[0.01em]">
                  {gregorianStr}
                </span>
              </div>
              <div className="w-px h-10 bg-[#f5efe2]/18 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] tracking-[0.22em] uppercase text-[#f5efe2]/38 font-medium">
                  Hijri
                </span>
                <span
                  className="text-[26px] text-[#f5efe2]"
                  style={{ ...AMIRI, ...RTL }}
                >
                  {hijriStr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── countdown / next prayer ── */}
        {nextPrayer ? (
          <div className="absolute left-16 bottom-14 max-w-[720px]">
            <div className="flex items-center gap-3 text-[12px] tracking-[0.28em] uppercase text-[oklch(0.82_0.08_78)] font-medium mb-3.5">
              <span className="ss-pulse w-2 h-2 rounded-full bg-[oklch(0.82_0.08_78)] shrink-0" />
              <span>Time until next prayer</span>
            </div>
            <div className="flex items-baseline gap-[22px] mb-2">
              <span
                className="text-[64px] leading-none tracking-[-0.01em] text-[#f5efe2] font-medium"
                style={CORMORANT}
              >
                {nextPrayer.en}
              </span>
              <span
                className="text-[48px] text-[#f5efe2]/62"
                style={{ ...AMIRI, ...RTL }}
              >
                {nextPrayer.ar}
              </span>
            </div>
            <div
              className="font-extralight text-[124px] leading-none tracking-[-0.04em] tabular-nums text-[#f5efe2] [text-shadow:0_4px_40px_rgba(0,0,0,.5)]"
              style={OUTFIT}
            >
              {countdown}
              <span className="text-[18px] tracking-[0.22em] uppercase text-[#f5efe2]/38 ml-3.5 align-middle font-medium">
                remaining
              </span>
            </div>
            <div className="mt-2 text-base text-[#f5efe2]/62 tracking-[0.02em]">
              Adhan at{" "}
              <strong className="text-[#f5efe2] font-medium">
                {nextPrayer.time}
              </strong>
              {afterPrayer && tillAfterStr && (
                <>
                  {" "}
                  · followed by {afterPrayer.en} in{" "}
                  <strong className="text-[#f5efe2] font-medium">
                    {tillAfterStr}
                  </strong>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute left-16 bottom-[220px]">
            <p className="text-[11px] tracking-[0.22em] uppercase text-[#f5efe2]/38 font-medium">
              Prayer times unavailable
            </p>
            <p className="mt-2.5 text-[18px] font-light text-[#f5efe2]/55">
              Configure a mosque in the app to enable live prayer times.
            </p>
          </div>
        )}

        {/* ── prayer rail ── */}
        <aside className="absolute top-1/2 right-16 -translate-y-1/2 w-[450px] bg-[rgba(14,12,9,0.55)] backdrop-blur-[28px] backdrop-saturate-120 border border-[rgba(245,239,226,0.18)] rounded-[28px] p-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="px-3 pt-1.5 pb-[18px] flex justify-between items-center border-b border-[rgba(245,239,226,0.18)]">
            <span className="text-[15px] tracking-[0.24em] uppercase text-[#f5efe2]/38 font-medium">
              Today's Salah
            </span>
            <span className="text-[16px] text-[#f5efe2]/62">
              {mosqueName ? `${dayStr} · ${mosqueName}` : dayStr}
            </span>
          </div>

          <div className="flex flex-col pt-2">
            {prayers.map((p) => {
              const Glyph = GLYPHS[p.key];
              const active = isRowActive(p.key);
              const passed = isRowPassed(p.key, p.time);
              return (
                <div
                  key={p.key}
                  className={`grid grid-cols-[50px_1fr_auto] items-center gap-3.5 px-3 py-3.5 rounded-[14px] relative border${active ? " ss-row-active" : " border-transparent"}`}
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(90deg,oklch(0.82 0.08 78/.18),oklch(0.82 0.08 78/.04))",
                          borderColor: "oklch(0.82 0.08 78/.35)",
                        }
                      : undefined
                  }
                >
                  {/* glyph */}
                  <div
                    className={`w-[50px] h-[50px] flex items-center justify-center${active ? " text-[oklch(0.82_0.08_78)]" : passed ? " text-[#f5efe2]/38" : " text-[#f5efe2]/38"}`}
                  >
                    {Glyph && <Glyph />}
                  </div>

                  {/* name */}
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-[21px] tracking-[0.01em]${active ? " text-[#f5efe2] font-medium" : passed ? " text-[#f5efe2]/38 font-normal" : " text-[#f5efe2] font-normal"}`}
                    >
                      {p.en}
                    </span>
                    <span
                      className={`text-[22px]${passed ? " text-[#f5efe2]/22" : " text-[#f5efe2]/38"}`}
                      style={{ ...AMIRI, ...RTL }}
                    >
                      {p.ar}
                    </span>
                  </div>

                  {/* time */}
                  <span
                    className={`text-[26px] font-light tabular-nums tracking-[-0.01em]${active ? " text-[oklch(0.82_0.08_78)]" : passed ? " text-[#f5efe2]/38" : " text-[#f5efe2]"}`}
                  >
                    {p.time}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── carousel pips — fixed 5, cycle through regardless of total slide count ── */}
        <div className="absolute left-1/2 bottom-6 -translate-x-1/2 flex gap-2">
          {Array.from({ length: PIP_COUNT }, (_, i) => {
            const isActive = i === activePip;
            return (
              <div
                key={`${i}-${pipEpoch}`}
                className={`w-6 h-[3px] rounded-[2px] overflow-hidden${isActive ? " bg-[rgba(245,239,226,0.35)]" : " bg-[rgba(245,239,226,0.22)]"}`}
              >
                <span
                  className={`block w-full h-full bg-[#f5efe2] scale-x-0 origin-left${isActive ? " ss-pip-fill" : ""}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
