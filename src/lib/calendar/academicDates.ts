/**
 * Curated academic calendar dates from the official University of Guelph
 * Schedule of Dates. Not scraped — maintained separately from course parsing.
 *
 * Sources:
 * https://calendar.uoguelph.ca/undergraduate-calendar/schedule-dates/
 *
 * Makeup / rescheduled class days (e.g. Dec 3–4 for F26, Apr 12 for W27)
 * are intentionally omitted in v1; see README limitations.
 */

export interface TermAcademicDates {
  termCode: string;
  /** First day of regularly scheduled classes (YYYY-MM-DD) */
  classesStart: string;
  /** Last day of regularly scheduled classes before makeup days / exams */
  classesEnd: string;
  /** Dates with no classes (holidays, study/reading break) */
  noClassDates: string[];
}

const TERM_DATES: Record<string, TermAcademicDates> = {
  F26: {
    termCode: "F26",
    classesStart: "2026-09-10",
    classesEnd: "2026-12-02",
    noClassDates: [
      "2026-10-12", // Thanksgiving — no classes
      "2026-10-13", // Fall Study Break Day — no classes
    ],
  },
  W27: {
    termCode: "W27",
    classesStart: "2027-01-11",
    classesEnd: "2027-04-09",
    noClassDates: [
      "2027-02-15", // Winter Break / Family Day week
      "2027-02-16",
      "2027-02-17",
      "2027-02-18",
      "2027-02-19",
      "2027-03-26", // Holiday — no classes (makeup Apr 12)
    ],
  },
};

export function getTermAcademicDates(
  termCode: string,
): TermAcademicDates | undefined {
  return TERM_DATES[termCode.toUpperCase()];
}

export function listCuratedTermCodes(): string[] {
  return Object.keys(TERM_DATES);
}
