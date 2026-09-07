import type { Weekday } from "@/lib/guelph/types";

const DAY_INDEX_TO_WEEKDAY: Weekday[] = [
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
];

const WEEKDAY_LABELS: Record<Weekday, string> = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
};

/** Ellucian days: 0=Sunday … 6=Saturday */
export function dayIndexToWeekday(day: number): Weekday | null {
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  return DAY_INDEX_TO_WEEKDAY[day];
}

export function dayIndexesToWeekdays(days: number[]): Weekday[] {
  const out: Weekday[] = [];
  for (const d of days) {
    const wd = dayIndexToWeekday(d);
    if (wd && !out.includes(wd)) out.push(wd);
  }
  return out;
}

export function formatWeekdays(days: Weekday[]): string {
  return days.map((d) => WEEKDAY_LABELS[d]).join(" / ");
}

export function weekdayLabel(day: Weekday): string {
  return WEEKDAY_LABELS[day];
}
