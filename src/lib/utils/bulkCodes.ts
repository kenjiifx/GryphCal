import { parseSearchQuery } from "@/lib/utils/courseCode";

/**
 * Parse pasted course lists like:
 * CIS*2030, ENGG 1500
 * MATH*1210; PSYC1000
 * FRHD*1010
 */
export function parseBulkCourseCodes(input: string): string[] {
  const parts = input
    .split(/[\n,;|/]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const codes: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const parsed = parseSearchQuery(part);
    if (parsed.kind !== "code") continue;
    if (seen.has(parsed.code)) continue;
    seen.add(parsed.code);
    codes.push(parsed.code);
  }
  return codes;
}
