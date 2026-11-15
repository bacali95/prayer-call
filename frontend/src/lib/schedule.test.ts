import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  formatCountdown,
  formatDuration,
  formatHijri,
  getNextPrayer,
  parseHM,
} from "@/lib/schedule";
import type { PrayerTimes } from "@/lib/prayers";

const times: PrayerTimes = { fajr: "06:12", shuruq: "07:58", dhuhr: "12:21", asr: "14:19", maghrib: "16:38", isha: "18:12" };
const at = (hm: string) => new Date(`2026-11-15T${hm}:00`);

describe("parseHM", () => {
  it("accepts valid and rejects invalid times", () => {
    expect(parseHM("6:05")).toEqual({ h: 6, m: 5 });
    expect(parseHM("24:00")).toBeNull();
    expect(parseHM("12:60")).toBeNull();
    expect(parseHM("noon")).toBeNull();
    expect(parseHM(undefined)).toBeNull();
  });
});

describe("getNextPrayer", () => {
  it("returns the first adhan prayer still ahead", () => {
    const next = getNextPrayer(times, at("13:30"));
    expect(next).toMatchObject({ key: "asr", time: "14:19", tomorrow: false });
  });

  it("skips shuruq: after Fajr the next prayer is Dhuhr", () => {
    expect(getNextPrayer(times, at("06:30"))?.key).toBe("dhuhr");
  });

  it("is Fajr before dawn", () => {
    expect(getNextPrayer(times, at("03:00"))).toMatchObject({ key: "fajr", tomorrow: false });
  });

  it("rolls over to tomorrow's Fajr after Isha", () => {
    const now = at("22:00");
    const next = getNextPrayer(times, now);
    expect(next?.key).toBe("fajr");
    expect(next?.tomorrow).toBe(true);
    expect(next?.date.getDate()).toBe(16);
    // 22:00 -> 06:12 next day
    expect(next!.date.getTime() - now.getTime()).toBe((8 * 60 + 12) * 60_000);
  });

  it("treats the exact prayer minute as passed", () => {
    expect(getNextPrayer(times, at("12:21"))?.key).toBe("asr");
  });

  it("works when shuruq is missing and returns null with no times", () => {
    const { shuruq: _s, ...rest } = times;
    void _s;
    expect(getNextPrayer(rest, at("13:00"))?.key).toBe("asr");
    expect(getNextPrayer({}, at("13:00"))).toBeNull();
    expect(getNextPrayer(undefined, at("13:00"))).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("marks passed, next and upcoming; shuruq is never next", () => {
    const tl = Object.fromEntries(buildTimeline(times, at("06:00")).map((e) => [e.key, e.status]));
    expect(tl).toEqual({
      fajr: "next",
      shuruq: "upcoming",
      dhuhr: "upcoming",
      asr: "upcoming",
      maghrib: "upcoming",
      isha: "upcoming",
    });
    const mid = Object.fromEntries(buildTimeline(times, at("08:30")).map((e) => [e.key, e.status]));
    expect(mid.fajr).toBe("passed");
    expect(mid.shuruq).toBe("passed");
    expect(mid.dhuhr).toBe("next");
  });

  it("has no next entry after Isha", () => {
    const tl = buildTimeline(times, at("23:00"));
    expect(tl.every((e) => e.status === "passed")).toBe(true);
  });

  it("ignores malformed times", () => {
    expect(buildTimeline({ fajr: "bad", dhuhr: "12:00" }, at("01:00")).map((e) => e.key)).toEqual(["dhuhr"]);
  });
});

describe("formatting", () => {
  it("formats countdowns as HH:MM:SS and clamps negatives", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
    expect(formatCountdown(100 * 3_600_000)).toBe("100:00:00");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });

  it("formats durations", () => {
    expect(formatDuration(9 * 60_000)).toBe("9m");
    expect(formatDuration(125 * 60_000)).toBe("2h 05m");
  });

  it("formats Hijri dates in English and Arabic", () => {
    const d = new Date("2026-11-15T12:00:00Z");
    expect(formatHijri(d, "en")).toMatch(/1448/);
    expect(formatHijri(d, "ar")).toMatch(/[؀-ۿ]/);
  });
});
