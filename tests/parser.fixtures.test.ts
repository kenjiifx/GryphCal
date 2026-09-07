import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCourseFromSectionsResponse,
  parseCourseSummaries,
  upstreamAdvancedSearchSchema,
} from "@/lib/guelph/parser";
import { normalizeTerms } from "@/lib/guelph/terms";

function loadFixture(name: string): unknown {
  const path = join(__dirname, "fixtures", name);
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("parser with real F26 fixtures", () => {
  it("discovers F26 and W27 terms", () => {
    const raw = loadFixture("f26-w27-advanced-search.json");
    const parsed = upstreamAdvancedSearchSchema.parse(raw);
    const terms = normalizeTerms(parsed.Terms ?? []);
    expect(terms.map((t) => t.code)).toEqual(["F26", "W27"]);
    expect(terms[0].name).toBe("Fall 2026");
  });

  it("parses CIS*2030 search results", () => {
    const summaries = parseCourseSummaries(
      loadFixture("f26-cis2030-search.json"),
    );
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].code).toBe("CIS*2030");
    expect(summaries[0].matchingSectionIds.length).toBeGreaterThan(1);
  });

  it("parses multi-component CIS*2030 sections", () => {
    const course = parseCourseFromSectionsResponse({
      term: "F26",
      courseId: "8927",
      courseCode: "CIS*2030",
      title: "Structure/Applicat - Microcomp",
      raw: loadFixture("f26-cis2030-sections.json"),
    });

    expect(course.sections.length).toBeGreaterThan(1);
    const first = course.sections[0];
    expect(first.number).toBeTruthy();
    expect(first.meetings.length).toBeGreaterThanOrEqual(2);

    const types = first.meetings.map((m) => m.type);
    expect(types).toContain("LEC");
    expect(types).toContain("LAB");

    const lec = first.meetings.find((m) => m.type === "LEC")!;
    expect(lec.isTBA).toBe(false);
    expect(lec.startTime).toBeTruthy();
    expect(lec.endTime).toBeTruthy();
    expect(lec.days.length).toBeGreaterThan(0);
    expect(lec.location).toBeTruthy();
  });

  it("handles missing instructor without discarding section", () => {
    const course = parseCourseFromSectionsResponse({
      term: "F26",
      courseId: "8927",
      courseCode: "CIS*2030",
      raw: loadFixture("f26-cis2030-sections.json"),
    });
    // Even if some lack faculty, sections remain
    expect(course.sections.every((s) => s.id && s.meetings)).toBe(true);
  });
});

describe("parser with real W27 fixtures", () => {
  it("parses W27 CIS*1500 search and sections", () => {
    const summaries = parseCourseSummaries(
      loadFixture("w27-cis1500-search.json"),
    );
    const match = summaries.find((c) => c.code === "CIS*1500");
    expect(match).toBeTruthy();

    const course = parseCourseFromSectionsResponse({
      term: "W27",
      courseId: match!.id,
      courseCode: "CIS*1500",
      title: match!.title,
      raw: loadFixture("w27-cis1500-sections.json"),
    });
    expect(course.sections.length).toBeGreaterThan(0);
    expect(course.sections[0].meetings.length).toBeGreaterThan(0);
  });
});

describe("DE / TBA courses", () => {
  it("marks DE meetings as TBA without inventing times", () => {
    const summaries = parseCourseSummaries(
      loadFixture("f26-frhd1010-search.json"),
    );
    const course = parseCourseFromSectionsResponse({
      term: "F26",
      courseId: summaries[0].id,
      courseCode: summaries[0].code,
      title: summaries[0].title,
      raw: loadFixture("f26-frhd1010-sections.json"),
    });

    const de = course.sections.find((s) =>
      /DE/i.test(s.displayName + s.number),
    );
    expect(de).toBeTruthy();
    expect(de!.meetings.length).toBeGreaterThan(0);
    expect(de!.meetings.every((m) => m.isTBA || !m.startTime)).toBe(true);
  });
});
