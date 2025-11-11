import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PRAYER_ORDER = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Sorts items by prayer order: reschedule first, then by prayer order
 * @param items Array of items with a 'prayer' property or [prayer, value] tuples
 * @returns Sorted array
 */
export function sortByPrayerOrder<
  T extends { prayer: string } | [string, unknown]
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aPrayer = Array.isArray(a) ? a[0] : a.prayer;
    const bPrayer = Array.isArray(b) ? b[0] : b.prayer;

    // Put reschedule first
    if (aPrayer === "reschedule" && bPrayer !== "reschedule") return -1;
    if (aPrayer !== "reschedule" && bPrayer === "reschedule") return 1;
    if (aPrayer === "reschedule" && bPrayer === "reschedule") return 0;

    // Sort by prayer order
    const aIndex = PRAYER_ORDER.indexOf(aPrayer);
    const bIndex = PRAYER_ORDER.indexOf(bPrayer);

    // If both are in the order list, sort by index
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // If only one is in the list, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // If neither is in the list, maintain original order
    return 0;
  });
}

/**
 * Parses a time string (HH:MM format) and returns a Date object for today
 * @param timeString Time in HH:MM format
 * @returns Date object or null if parsing fails
 */
export function parseTimeString(timeString: string): Date | null {
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Checks if a prayer time has already passed today
 * @param timeString Time in HH:MM format
 * @returns true if the time has passed, false otherwise
 */
export function isTimePassed(timeString: string): boolean {
  const prayerTime = parseTimeString(timeString);
  if (!prayerTime) return false;

  const now = new Date();
  return now >= prayerTime;
}

/**
 * Calculates the countdown string from now until a prayer time
 * @param timeString Time in HH:MM format
 * @returns Countdown string (e.g., "2h 30m") or null if time has passed
 */
export function getCountdown(timeString: string): string | null {
  const prayerTime = parseTimeString(timeString);
  if (!prayerTime) return null;

  const now = new Date();
  const diff = prayerTime.getTime() - now.getTime();

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hr" : "hrs"} ${minutes} ${
      minutes === 1 ? "min" : "mins"
    }`;
  } else if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? "min" : "mins"} ${seconds} ${
      seconds === 1 ? "sec" : "secs"
    }`;
  } else {
    return `${seconds} ${seconds === 1 ? "sec" : "secs"}`;
  }
}
