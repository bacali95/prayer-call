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
