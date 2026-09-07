import { describe, expect, it } from "vitest";
import { findConflicts, selectedToBlocks } from "@/lib/utils/conflicts";
import type { SelectedSection } from "@/lib/guelph/types";

const a: SelectedSection = {
  term: "F26",
  courseId: "1",
  courseCode: "CIS*2030",
  courseTitle: "A",
  section: {
    id: "s1",
    displayName: "0101",
    number: "0101",
    meetings: [
      {
        type: "LEC",
        typeLabel: "Lecture",
        days: ["TU"],
        startTime: "08:30",
        endTime: "09:50",
        isOnline: false,
        isTBA: false,
      },
    ],
  },
};

const b: SelectedSection = {
  term: "F26",
  courseId: "2",
  courseCode: "CIS*2430",
  courseTitle: "B",
  section: {
    id: "s2",
    displayName: "0101",
    number: "0101",
    meetings: [
      {
        type: "LEC",
        typeLabel: "Lecture",
        days: ["TU"],
        startTime: "09:00",
        endTime: "10:20",
        isOnline: false,
        isTBA: false,
      },
    ],
  },
};

describe("conflicts", () => {
  it("detects overlapping meetings", () => {
    const blocks = selectedToBlocks([a, b]);
    const conflicts = findConflicts(blocks);
    expect(conflicts.length).toBe(1);
  });

  it("ignores TBA meetings", () => {
    const tba: SelectedSection = {
      ...b,
      section: {
        ...b.section,
        id: "s3",
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
    expect(selectedToBlocks([tba])).toHaveLength(0);
  });
});
