import { describe, expect, it } from "vitest";
import { countTimedEvents, generateIcs } from "@/lib/calendar/generate";
import type { SelectedSection } from "@/lib/guelph/types";

const lecLab: SelectedSection = {
  term: "F26",
  courseId: "8927",
  courseCode: "CIS*2030",
  courseTitle: "Structure/Applicat - Microcomp",
  section: {
    id: "213525",
    displayName: "CIS*2030*0101",
    number: "0101",
    instructor: "Randhawa, G",
    meetings: [
      {
        type: "LEC",
        typeLabel: "Lecture",
        days: ["TU", "TH"],
        startTime: "08:30",
        endTime: "09:50",
        location: "ROZH 103",
        startDate: "2026-09-10",
        endDate: "2026-12-22",
        isOnline: false,
        isTBA: false,
      },
      {
        type: "LAB",
        typeLabel: "Laboratory",
        days: ["WE"],
        startTime: "08:30",
        endTime: "11:20",
        location: "SSC 1303",
        startDate: "2026-09-10",
        endDate: "2026-12-22",
        isOnline: false,
        isTBA: false,
      },
    ],
  },
};

const deCourse: SelectedSection = {
  term: "F26",
  courseId: "1",
  courseCode: "FRHD*1010",
  courseTitle: "Human Development",
  section: {
    id: "de01",
    displayName: "FRHD*1010*DE01",
    number: "DE01",
    meetings: [
      {
        type: "LEC",
        typeLabel: "Lecture",
        days: [],
        isOnline: false,
        isTBA: true,
      },
    ],
  },
};

describe("ICS generation", () => {
  it("emits RFC5545 calendar with timezone and RRULE", () => {
    const ics = generateIcs({ selected: [lecLab] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("PRODID:");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:");
    expect(ics).toContain("@gryphcal.app");
    expect(ics).toContain("DTSTAMP");
    expect(ics).toContain("SUMMARY:CIS*2030 - Lecture");
    expect(ics).toContain("SUMMARY:CIS*2030 - Laboratory");
    expect(ics).toContain("LOCATION:ROZH 103");
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY/);
    expect(ics).toMatch(/BYDAY=.*TU/);
    expect(ics).toContain("America/Toronto");
    expect(countTimedEvents([lecLab])).toBe(2);
  });

  it("does not create timed events for DE/TBA courses", () => {
    expect(countTimedEvents([deCourse])).toBe(0);
    const ics = generateIcs({ selected: [deCourse] });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("includes EXDATE for curated no-class days when weekday matches", () => {
    const ics = generateIcs({ selected: [lecLab] });
    // Oct 13 2026 is a Tuesday — should exclude LEC
    expect(ics).toMatch(/EXDATE/);
  });

  it("uses deterministic UIDs", () => {
    const a = generateIcs({ selected: [lecLab] });
    const b = generateIcs({ selected: [lecLab] });
    const uidA = [...a.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    const uidB = [...b.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    expect(uidA).toEqual(uidB);
  });
});
