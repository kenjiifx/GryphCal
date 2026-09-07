import { z } from "zod";
import type { SelectedSection } from "@/lib/guelph/types";

const STORAGE_KEY = "gryphcal:v1";

const meetingSchema = z.object({
  type: z.string().max(32),
  typeLabel: z.string().max(64),
  days: z.array(z.enum(["SU", "MO", "TU", "WE", "TH", "FR", "SA"])).max(7),
  startTime: z.string().max(16).optional(),
  endTime: z.string().max(16).optional(),
  location: z.string().max(120).optional(),
  startDate: z.string().max(32).optional(),
  endDate: z.string().max(32).optional(),
  isOnline: z.boolean(),
  isTBA: z.boolean(),
});

export const selectedSectionSchema = z.object({
  term: z.string().max(16),
  courseId: z.string().max(64),
  courseCode: z.string().max(32),
  courseTitle: z.string().max(200),
  section: z.object({
    id: z.string().max(64),
    displayName: z.string().max(120),
    number: z.string().max(32),
    instructor: z.string().max(120).optional(),
    deliveryMethod: z.string().max(64).optional(),
    meetings: z.array(meetingSchema).max(40),
  }),
});

const persistedSchema = z.object({
  term: z.string().max(16),
  selected: z.array(selectedSectionSchema).max(20),
});

export type PersistedState = z.infer<typeof persistedSchema>;

export function loadPersistedState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = persistedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearPersistedState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Compact share payload in the URL hash (no server, no accounts). */
export function encodeShareHash(state: PersistedState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShareHash(hash: string): PersistedState | null {
  try {
    const padded = hash.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = persistedSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readShareFromLocation(): PersistedState | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#s=/, "").replace(/^#/, "");
  if (!hash || hash.length < 8) return null;
  return decodeShareHash(hash);
}

export function writeShareToLocation(state: PersistedState): string {
  const encoded = encodeShareHash(state);
  const url = `${window.location.origin}${window.location.pathname}#s=${encoded}`;
  window.history.replaceState(null, "", `#s=${encoded}`);
  return url;
}

export type { SelectedSection };
