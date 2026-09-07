import ical, {
  ICalCalendarMethod,
  ICalEventRepeatingFreq,
  ICalWeekday,
  type ICalCalendar,
} from "ical-generator";
import { DateTime } from "luxon";
import { getTermAcademicDates } from "@/lib/calendar/academicDates";
import type { Meeting, SelectedSection, Weekday } from "@/lib/guelph/types";
import { isSchedulable } from "@/lib/utils/conflicts";

const TIMEZONE = "America/Toronto";
const UID_DOMAIN = "gryphcal.app";
const PRODID = {
  company: "GryphCal",
  product: "University of Guelph Timetable",
  language: "EN",
};

const BYDAY: Record<Weekday, ICalWeekday> = {
  SU: ICalWeekday.SU,
  MO: ICalWeekday.MO,
  TU: ICalWeekday.TU,
  WE: ICalWeekday.WE,
  TH: ICalWeekday.TH,
  FR: ICalWeekday.FR,
  SA: ICalWeekday.SA,
};

export interface GenerateCalendarOptions {
  selected: SelectedSection[];
  calendarName?: string;
}

export function generateIcs(options: GenerateCalendarOptions): string {
  const calendar = ical({
    name: options.calendarName ?? "GryphCal Timetable",
    prodId: PRODID,
    timezone: TIMEZONE,
    method: ICalCalendarMethod.PUBLISH,
    scale: "GREGORIAN",
  });

  for (const item of options.selected) {
    item.section.meetings.forEach((meeting, meetingIndex) => {
      if (!isSchedulable(meeting)) return;
      addMeetingEvent(calendar, item, meeting, meetingIndex);
    });
  }

  return calendar.toString();
}

/** Count timed VEVENTs that would be emitted (excludes DE/TBA). */
export function countTimedEvents(selected: SelectedSection[]): number {
  let count = 0;
  for (const item of selected) {
    for (const meeting of item.section.meetings) {
      if (isSchedulable(meeting)) count += 1;
    }
  }
  return count;
}

function addMeetingEvent(
  calendar: ICalCalendar,
  item: SelectedSection,
  meeting: Meeting,
  meetingIndex: number,
): void {
  const academic = getTermAcademicDates(item.term);
  const startDate =
    meeting.startDate ?? academic?.classesStart ?? undefined;
  const endBound =
    earliestDate(meeting.endDate, academic?.classesEnd) ??
    meeting.endDate ??
    academic?.classesEnd;

  if (!startDate || !endBound || !meeting.startTime || !meeting.endTime) {
    return;
  }

  const firstOccurrence = firstOccurrenceOnOrAfter(startDate, meeting.days);
  if (!firstOccurrence) return;

  const [sh, sm] = meeting.startTime.split(":").map(Number);
  const [eh, em] = meeting.endTime.split(":").map(Number);

  const dtStart = firstOccurrence.set({
    hour: sh,
    minute: sm,
    second: 0,
    millisecond: 0,
  });
  let dtEnd = firstOccurrence.set({
    hour: eh,
    minute: em,
    second: 0,
    millisecond: 0,
  });
  if (dtEnd <= dtStart) {
    dtEnd = dtEnd.plus({ days: 1 });
  }

  const until = DateTime.fromISO(endBound, { zone: TIMEZONE })
    .endOf("day")
    .toUTC();

  const uid = buildUid(
    item.term,
    item.courseCode,
    item.section.id,
    meeting.type,
    meetingIndex,
  );

  const summary = `${item.courseCode} - ${meeting.typeLabel}`;
  const description = [
    `Course: ${item.courseCode}`,
    `Section: ${item.section.number}`,
    `Component: ${meeting.typeLabel}`,
    item.section.instructor
      ? `Instructor: ${item.section.instructor}`
      : null,
    `Source: University of Guelph`,
  ]
    .filter(Boolean)
    .join("\n");

  const exdates: DateTime[] = [];
  for (const d of academic?.noClassDates ?? []) {
    const day = DateTime.fromISO(d, { zone: TIMEZONE });
    if (!day.isValid) continue;
    if (!meeting.days.includes(luxonWeekdayToOur(day.weekday))) continue;
    exdates.push(
      day.set({
        hour: sh,
        minute: sm,
        second: 0,
        millisecond: 0,
      }),
    );
  }

  calendar.createEvent({
    id: uid,
    start: dtStart.toJSDate(),
    end: dtEnd.toJSDate(),
    timezone: TIMEZONE,
    summary,
    description,
    location: meeting.location,
    repeating: {
      freq: ICalEventRepeatingFreq.WEEKLY,
      byDay: meeting.days.map((d) => BYDAY[d]),
      until: until.toJSDate(),
      ...(exdates.length
        ? { exclude: exdates.map((dt) => dt.toJSDate()) }
        : {}),
    },
  });
}

function buildUid(
  term: string,
  courseCode: string,
  sectionId: string,
  component: string,
  meetingIndex: number,
): string {
  const raw = [term, courseCode, sectionId, component, String(meetingIndex)]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${raw}@${UID_DOMAIN}`;
}

function firstOccurrenceOnOrAfter(
  startDate: string,
  days: Weekday[],
): DateTime | null {
  if (!days.length) return null;
  let cursor = DateTime.fromISO(startDate, { zone: TIMEZONE }).startOf("day");
  if (!cursor.isValid) return null;

  for (let i = 0; i < 8; i++) {
    const our = luxonWeekdayToOur(cursor.weekday);
    if (days.includes(our)) return cursor;
    cursor = cursor.plus({ days: 1 });
  }
  return null;
}

/** Luxon: 1=Monday … 7=Sunday */
function luxonWeekdayToOur(weekday: number): Weekday {
  const map: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  return map[weekday - 1];
}

function earliestDate(
  a?: string,
  b?: string,
): string | undefined {
  if (a && b) return a < b ? a : b;
  return a ?? b;
}
