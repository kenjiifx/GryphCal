import { describe, expect, it } from "vitest";
import { parseBulkCourseCodes } from "@/lib/utils/bulkCodes";
import { decodeShareHash, encodeShareHash } from "@/lib/utils/persist";

describe("parseBulkCourseCodes", () => {
  it("parses mixed separators and formats", () => {
    const codes = parseBulkCourseCodes(
      "CIS*2030, CIS 2430\ncis2520; MATH*1210",
    );
    expect(codes).toEqual([
      "CIS*2030",
      "CIS*2430",
      "CIS*2520",
      "MATH*1210",
    ]);
  });

  it("dedupes and ignores junk", () => {
    expect(parseBulkCourseCodes("CIS*2030\nhello\nCIS*2030")).toEqual([
      "CIS*2030",
    ]);
  });
});

describe("share hash", () => {
  it("round-trips timetable state", () => {
    const state = {
      term: "F26",
      selected: [
        {
          term: "F26",
          courseId: "1",
          courseCode: "CIS*2030",
          courseTitle: "Micro",
          section: {
            id: "s1",
            displayName: "0101",
            number: "0101",
            meetings: [
              {
                type: "LEC",
                typeLabel: "Lecture",
                days: ["TU" as const],
                startTime: "08:30",
                endTime: "09:50",
                isOnline: false,
                isTBA: false,
              },
            ],
          },
        },
      ],
    };
    const encoded = encodeShareHash(state);
    expect(decodeShareHash(encoded)).toEqual(state);
  });
});
