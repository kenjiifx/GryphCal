import { describe, expect, it } from "vitest";
import {
  dayIndexToWeekday,
  dayIndexesToWeekdays,
  formatWeekdays,
} from "@/lib/utils/weekdays";
import { formatTime12h, parseTimeToHHmm, timeToMinutes } from "@/lib/utils/times";

describe("weekdays", () => {
  it("maps Ellucian day indexes", () => {
    expect(dayIndexToWeekday(0)).toBe("SU");
    expect(dayIndexToWeekday(1)).toBe("MO");
    expect(dayIndexToWeekday(2)).toBe("TU");
    expect(dayIndexToWeekday(6)).toBe("SA");
    expect(dayIndexToWeekday(7)).toBeNull();
  });

  it("dedupes and formats", () => {
    expect(dayIndexesToWeekdays([2, 4, 2])).toEqual(["TU", "TH"]);
    expect(formatWeekdays(["TU", "TH"])).toBe("Tue / Thu");
  });
});

describe("times", () => {
  it("parses 24h and 12h", () => {
    expect(parseTimeToHHmm("08:30:00")).toBe("08:30");
    expect(parseTimeToHHmm("8:30 AM")).toBe("08:30");
    expect(parseTimeToHHmm("5:30 PM")).toBe("17:30");
    expect(parseTimeToHHmm("12:00 PM")).toBe("12:00");
    expect(parseTimeToHHmm("12:15 AM")).toBe("00:15");
    expect(parseTimeToHHmm("TBD")).toBeNull();
  });

  it("converts to minutes and 12h display", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(formatTime12h("17:30")).toBe("5:30 PM");
  });
});
