import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card } from "../ui/card";

type YearPrayerTimeData = {
  dayOfYear: number;
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  isDST: boolean;
  gregorian: string;
  hijri: string;
};

type DSTTransition = {
  dayOfYear: number;
  date: string;
};

type PrayerTimesYearChartProps = {
  data: YearPrayerTimeData[];
  year: number;
  dstTransitions?: DSTTransition[];
};

// Convert time string (HH:MM) to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Convert minutes to percentage (0% = 00:00, 100% = 23:59)
// 23:59 = 1439 minutes
const minutesToPercent = (minutes: number): number => {
  return (minutes / 1439) * 100;
};

// Convert percentage back to minutes
const percentToMinutes = (percent: number): number => {
  return (percent / 100) * 1440;
};

// Convert minutes to time string (HH:MM)
const minutesToHours = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  return hours.toString().padStart(2, "0") + "h";
};

export const PrayerTimesYearChart: React.FC<PrayerTimesYearChartProps> = ({
  data,
  year,
  dstTransitions = [],
}) => {
  // Calculate current day of year
  const currentDayOfYear = useMemo(() => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const diffTime = today.getTime() - startOfYear.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    // Only show if it's the same year as the chart
    return today.getFullYear() === year ? diffDays : null;
  }, [year]);

  // Transform data for chart with percentage-based areas
  // Each area represents the interval between consecutive prayers
  const chartData = useMemo(() => {
    return data.map((item) => {
      const fajr = timeToMinutes(item.fajr);
      const dhuhr = timeToMinutes(item.dhuhr);
      const asr = timeToMinutes(item.asr);
      const maghrib = timeToMinutes(item.maghrib);
      const isha = timeToMinutes(item.isha);

      // Convert to percentages (0% = 00:00, 100% = 23:59)
      const fajrPercent = minutesToPercent(fajr);
      const dhuhrPercent = minutesToPercent(dhuhr);
      const asrPercent = minutesToPercent(asr);
      const maghribPercent = minutesToPercent(maghrib);
      const ishaPercent = minutesToPercent(isha);

      // Calculate interval percentages (duration between prayers as % of day)
      // Each area represents the time interval between two consecutive prayers
      const beforeFajr = fajrPercent; // 0% to Fajr
      const fajrToDhuhr = dhuhrPercent - fajrPercent; // Fajr to Dhuhr interval
      const dhuhrToAsr = asrPercent - dhuhrPercent; // Dhuhr to Asr interval
      const asrToMaghrib = maghribPercent - asrPercent; // Asr to Maghrib interval
      const maghribToIsha = ishaPercent - maghribPercent; // Maghrib to Isha interval
      const afterIsha = 100 - ishaPercent; // Isha to 100% (23:59)

      return {
        dayOfYear: item.dayOfYear,
        date: item.date,
        // Store original times for tooltip
        fajrTime: item.fajr,
        dhuhrTime: item.dhuhr,
        asrTime: item.asr,
        maghribTime: item.maghrib,
        ishaTime: item.isha,
        // Store formatted dates from backend
        gregorian: item.gregorian,
        hijri: item.hijri,
        // Store interval percentages for stacked areas
        // Each value represents the duration of that interval as % of day
        beforeFajr: beforeFajr,
        fajrToDhuhr: fajrToDhuhr,
        dhuhrToAsr: dhuhrToAsr,
        asrToMaghrib: asrToMaghrib,
        maghribToIsha: maghribToIsha,
        afterIsha: afterIsha,
        isDST: item.isDST,
      };
    });
  }, [data]);

  // Custom tooltip
  type TooltipProps = {
    active?: boolean;
    payload?: Array<{
      dataKey: string;
      value: number;
      color: string;
      payload: {
        date: string;
        dayOfYear: number;
        fajrTime?: string;
        dhuhrTime?: string;
        asrTime?: string;
        maghribTime?: string;
        ishaTime?: string;
        gregorian?: string;
        hijri?: string;
      };
    }>;
  };

  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      // Prayer names with colors matching the chart
      const prayerColors: Record<string, string> = {
        fajr: "#8884d8",
        dhuhr: "#82ca9d",
        asr: "#ffc658",
        maghrib: "#ff7300",
        isha: "#8dd1e1",
      };

      const prayers = [
        { name: "Fajr", time: data.fajrTime, color: prayerColors.fajr },
        { name: "Dhuhr", time: data.dhuhrTime, color: prayerColors.dhuhr },
        { name: "Asr", time: data.asrTime, color: prayerColors.asr },
        {
          name: "Maghrib",
          time: data.maghribTime,
          color: prayerColors.maghrib,
        },
        { name: "Isha", time: data.ishaTime, color: prayerColors.isha },
      ];

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <div className="mb-2">
            <p className="font-semibold">{data.gregorian || data.date}</p>
            {data.hijri && (
              <p className="text-sm text-muted-foreground mt-1">{data.hijri}</p>
            )}
          </div>
          <div className="space-y-1 text-sm">
            {prayers.map((prayer, index) => (
              <p key={index} style={{ color: prayer.color }}>
                <span className="font-medium">{prayer.name}:</span>{" "}
                {prayer.time || "N/A"}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Y-axis tick formatter - show time (every 3 hours)
  const formatYAxisTick = (value: number): string => {
    // Convert percentage to minutes, then to time
    const minutes = percentToMinutes(value);
    return minutesToHours(minutes);
  };

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">
          No data available for the chart
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Prayer Times Throughout {year}
      </h3>
      <ResponsiveContainer width="100%" height={450}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorBeforeFajr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e0e0e0" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#e0e0e0" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="colorFajrToDhuhr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={1.0} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="colorDhuhrToAsr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82ca9d" stopOpacity={1.0} />
              <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="colorAsrToMaghrib" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffc658" stopOpacity={1.0} />
              <stop offset="95%" stopColor="#ffc658" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="colorMaghribToIsha" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff7300" stopOpacity={1.0} />
              <stop offset="95%" stopColor="#ff7300" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="colorAfterIsha" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8dd1e1" stopOpacity={1.0} />
              <stop offset="95%" stopColor="#8dd1e1" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
          <XAxis
            dataKey="dayOfYear"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            ticks={[]}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={formatYAxisTick}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            ticks={[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {/* Current day reference line - more prominent than DST lines */}
          {currentDayOfYear !== null && (
            <ReferenceLine
              x={currentDayOfYear}
              stroke="#3b82f6"
              strokeWidth={3}
              strokeOpacity={0.8}
              label={{
                value: "Today",
                position: "top",
                fill: "#3b82f6",
                fontSize: 12,
                fontWeight: "bold",
              }}
            />
          )}
          {/* DST transition reference lines */}
          {dstTransitions.map((transition) => (
            <ReferenceLine
              key={`dst-${transition.dayOfYear}`}
              x={transition.dayOfYear}
              stroke="#ff6b6b"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: "DST",
                position: "top",
                fill: "#ff6b6b",
                fontSize: 10,
              }}
            />
          ))}
          {/* Stacked areas representing intervals between prayers */}
          {/* Each area shows the time interval between consecutive prayers */}
          <Area
            type="monotone"
            dataKey="beforeFajr"
            stackId="1"
            stroke="none"
            fill="url(#colorBeforeFajr)"
            name="Before Fajr"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="fajrToDhuhr"
            stackId="1"
            stroke="none"
            fill="url(#colorFajrToDhuhr)"
            name="Fajr to Dhuhr"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="dhuhrToAsr"
            stackId="1"
            stroke="none"
            fill="url(#colorDhuhrToAsr)"
            name="Dhuhr to Asr"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="asrToMaghrib"
            stackId="1"
            stroke="none"
            fill="url(#colorAsrToMaghrib)"
            name="Asr to Maghrib"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="maghribToIsha"
            stackId="1"
            stroke="none"
            fill="url(#colorMaghribToIsha)"
            name="Maghrib to Isha"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="afterIsha"
            stackId="1"
            stroke="none"
            fill="url(#colorAfterIsha)"
            name="After Isha"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          This percent area chart shows prayer times throughout the year. Each
          colored area represents the time interval between consecutive prayers.
          The Y-axis shows the time of day as a percentage (0% = 00:00, 100% =
          23:59). The X-axis shows days of the year. Wider areas indicate longer
          intervals between prayers, narrower areas indicate shorter intervals.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
          {currentDayOfYear !== null && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span>Today</span>
              </div>
              <span>•</span>
            </>
          )}
          {dstTransitions.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 border-t-2 border-dashed border-red-400"></div>
                <span>DST Transition</span>
              </div>
              <span>•</span>
              <span>DST periods show a 1-hour time shift (summer time)</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
