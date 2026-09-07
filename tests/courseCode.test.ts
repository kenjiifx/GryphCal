import { describe, expect, it } from "vitest";
import {
  normalizeCourseCode,
  parseSearchQuery,
  splitCourseCode,
} from "@/lib/utils/courseCode";

describe("normalizeCourseCode", () => {
  it.each([
    ["CIS2030", "CIS*2030"],
    ["CIS 2030", "CIS*2030"],
    ["CIS*2030", "CIS*2030"],
    ["cis2030", "CIS*2030"],
    ["cis*2030", "CIS*2030"],
    ["  cis 2030  ", "CIS*2030"],
    ["MATH*1210", "MATH*1210"],
    ["ENGG1500", "ENGG*1500"],
    ["HK 2270", "HK*2270"],
    ["FRHD*1010", "FRHD*1010"],
    ["PSYC1000", "PSYC*1000"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizeCourseCode(input)).toBe(expected);
  });

  it("does not squash free-text titles into fake codes", () => {
    expect(normalizeCourseCode("Organic Chemistry")).toBe("");
    expect(normalizeCourseCode("introduction to computing")).toBe("");
    expect(normalizeCourseCode("biology")).toBe("");
  });

  it("returns empty for blank input", () => {
    expect(normalizeCourseCode("   ")).toBe("");
  });
});

describe("parseSearchQuery", () => {
  const known = new Set(["MATH", "CIS", "ENGG", "PSYC", "BIOC"]);

  it("classifies codes", () => {
    expect(parseSearchQuery("engg 1500", { knownSubjects: known }).kind).toBe(
      "code",
    );
  });

  it("classifies known subjects only", () => {
    expect(parseSearchQuery("MATH", { knownSubjects: known })).toEqual({
      kind: "subject",
      raw: "MATH",
      subject: "MATH",
    });
    expect(parseSearchQuery("psyc", { knownSubjects: known }).kind).toBe(
      "subject",
    );
  });

  it("keeps title words as text even if letter-only", () => {
    expect(parseSearchQuery("organic", { knownSubjects: known })).toEqual({
      kind: "text",
      raw: "organic",
      text: "organic",
    });
    expect(parseSearchQuery("biology", { knownSubjects: known }).kind).toBe(
      "text",
    );
    expect(parseSearchQuery("Organic Chemistry")).toEqual({
      kind: "text",
      raw: "Organic Chemistry",
      text: "Organic Chemistry",
    });
  });
});

describe("splitCourseCode", () => {
  it("splits subject and number across departments", () => {
    expect(splitCourseCode("cis 2430")).toEqual({
      subject: "CIS",
      number: "2430",
    });
    expect(splitCourseCode("BIOC*2580")).toEqual({
      subject: "BIOC",
      number: "2580",
    });
  });
});
