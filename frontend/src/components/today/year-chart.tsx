import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearData } from "@/lib/types";

const DAY_MIN = 1440;

function toMin(t: string, dst: boolean): number {
  const [h, m] = t.split(":").map(Number);
  // Normalise DST so the curves stay continuous across the clock change.
  return (((dst ? h - 1 : h) + 24) % 24) * 60 + m;
}

const BANDS = [
  { key: "night", label: "Night", color: "var(--chart-1)" },
  { key: "fajrDhuhr", label: "Fajr to Dhuhr", color: "var(--chart-2)" },
  { key: "dhuhrAsr", label: "Dhuhr to Asr", color: "var(--chart-3)" },
  { key: "asrMaghrib", label: "Asr to Maghrib", color: "var(--chart-4)" },
  { key: "maghribIsha", label: "Maghrib to Isha", color: "var(--chart-5)" },
  { key: "afterIsha", label: "After Isha", color: "var(--chart-6)" },
] as const;

export default function YearChart({ year }: { year: YearData }) {
  const today = new Date();
  const dayOfYear =
    today.getFullYear() === year.year
      ? Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86_400_000)
      : null;

  const rows = useMemo(
    () =>
      year.data.map((d) => {
        const f = toMin(d.fajr, d.isDST);
        const h = toMin(d.dhuhr, d.isDST);
        const a = toMin(d.asr, d.isDST);
        const m = toMin(d.maghrib, d.isDST);
        const i = toMin(d.isha, d.isDST);
        return {
          dayOfYear: d.dayOfYear,
          date: d.gregorian || d.date,
          times: d,
          night: f,
          fajrDhuhr: h - f,
          dhuhrAsr: a - h,
          asrMaghrib: m - a,
          maghribIsha: i - m,
          afterIsha: Math.max(0, DAY_MIN - i),
        };
      }),
    [year.data],
  );

  return (
    <div>
      <div className="h-72 w-full" role="img" aria-label={`Prayer times across ${year.year}, day by day`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} stackOffset="none">
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dayOfYear"
              type="number"
              domain={[1, 365]}
              ticks={[1, 91, 182, 274, 365]}
              tickFormatter={(d: number) =>
                new Date(year.year, 0, d).toLocaleDateString("en-GB", { month: "short" })
              }
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
            />
            <YAxis
              domain={[0, DAY_MIN]}
              ticks={[0, 360, 720, 1080, 1440]}
              tickFormatter={(v: number) => `${String(v / 60).padStart(2, "0")}h`}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
            />
            <Tooltip
              content={({ active, payload }) => {
                const row = active && payload?.[0]?.payload;
                if (!row) return null;
                const t = row.times as YearData["data"][number];
                return (
                  <div className="rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1 font-medium">{row.date}</p>
                    <dl className="grid grid-cols-[auto_auto] gap-x-4 num">
                      {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((k) => (
                        <div key={k} className="contents">
                          <dt className="capitalize text-muted-foreground">{k}</dt>
                          <dd>{t[k]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              }}
            />
            {BANDS.map((b) => (
              <Area
                key={b.key}
                type="monotone"
                dataKey={b.key}
                stackId="day"
                stroke="none"
                fill={b.color}
                fillOpacity={0.95}
                isAnimationActive={false}
              />
            ))}
            {dayOfYear && <ReferenceLine x={dayOfYear} stroke="var(--primary)" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {BANDS.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: b.color }} />
            {b.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
