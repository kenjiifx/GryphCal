/**
 * Parse wall-clock times from Guelph/Ellucian data.
 * Accepts "08:30:00", "8:30 AM", "15:20", etc.
 * Returns "HH:mm" 24-hour, or null if unusable.
 */
export function parseTimeToHHmm(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw || raw === "-" || /^tbd$/i.test(raw)) return null;

  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2]);
    const period = ampm[4].toUpperCase();
    if (period === "AM") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${pad(hour)}:${pad(minute)}`;
  }

  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return null;
    return `${pad(hour)}:${pad(minute)}`;
  }

  return null;
}

/** Minutes since midnight for conflict math. */
export function timeToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatTime12h(hhmm: string): string {
  const minutes = timeToMinutes(hhmm);
  if (minutes === null) return hhmm;
  let hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${pad(minute)} ${period}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
