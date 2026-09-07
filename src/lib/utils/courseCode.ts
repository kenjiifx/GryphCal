/**
 * University of Guelph course-code helpers.
 * Subjects are typically 2–5 letters (CIS, HK, ENGG, BIOC, FRHD, …).
 */

const CODE_WITH_STAR =
  /^([A-Z]{2,8})\*([A-Z]?\d{2,4}[A-Z]{0,3})$/;
const CODE_GLUED =
  /^([A-Z]{2,8})([A-Z]?\d{2,4}[A-Z]{0,3})$/;
const LETTERS_ONLY = /^[A-Z]{2,8}$/;

export type ParsedSearchQuery =
  | { kind: "code"; raw: string; code: string; subject: string; number: string }
  | { kind: "subject"; raw: string; subject: string }
  | { kind: "text"; raw: string; text: string };

export interface ParseSearchOptions {
  /** Official subject codes from the catalog (MATH, CIS, ENGG, …). */
  knownSubjects?: ReadonlySet<string>;
}

/**
 * Normalize only when input is a course code.
 * Returns "" for titles / free text so callers keep the original query.
 */
export function normalizeCourseCode(input: string): string {
  const parsed = parseSearchQuery(input);
  return parsed.kind === "code" ? parsed.code : "";
}

export function splitCourseCode(code: string): {
  subject: string;
  number: string;
} | null {
  const parsed = parseSearchQuery(code);
  if (parsed.kind !== "code") return null;
  return { subject: parsed.subject, number: parsed.number };
}

export function looksLikeCourseCode(input: string): boolean {
  return parseSearchQuery(input).kind === "code";
}

/**
 * Classify user input for catalog search.
 * - code: CIS*2030 / cis2030 / ENGG 1500
 * - subject: MATH / engg / PSYC (only when listed in knownSubjects)
 * - text: "organic chemistry", "biology", "microcomputers"
 */
export function parseSearchQuery(
  input: string,
  options: ParseSearchOptions = {},
): ParsedSearchQuery {
  const raw = input.trim();
  if (!raw) return { kind: "text", raw: "", text: "" };

  const compact = raw.toUpperCase().replace(/\s+/g, "");

  const star = compact.match(CODE_WITH_STAR);
  if (star) {
    return {
      kind: "code",
      raw,
      code: `${star[1]}*${star[2]}`,
      subject: star[1],
      number: star[2],
    };
  }

  // Glued codes need a digit so "MATH" stays subject/text, not a code
  const glued = compact.match(CODE_GLUED);
  if (glued && /\d/.test(glued[2])) {
    return {
      kind: "code",
      raw,
      code: `${glued[1]}*${glued[2]}`,
      subject: glued[1],
      number: glued[2],
    };
  }

  if (LETTERS_ONLY.test(compact) && options.knownSubjects?.has(compact)) {
    return { kind: "subject", raw, subject: compact };
  }

  return {
    kind: "text",
    raw,
    text: raw.replace(/\s+/g, " ").trim(),
  };
}
