import { z } from "zod";
import { instructionalMethodLabel } from "@/lib/utils/labels";
import { parseTimeToHHmm } from "@/lib/utils/times";
import { dayIndexesToWeekdays } from "@/lib/utils/weekdays";
import type {
  Course,
  CourseSummary,
  Meeting,
  Section,
} from "@/lib/guelph/types";

const looseRecord = z.record(z.string(), z.unknown());

export const upstreamCourseSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).transform(String),
    SubjectCode: z.string(),
    Number: z.string(),
    Title: z.string().optional().nullable(),
    Description: z.string().optional().nullable(),
    MatchingSectionIds: z
      .array(z.union([z.string(), z.number()]).transform(String))
      .optional()
      .nullable(),
  })
  .passthrough();

export const upstreamSearchResponseSchema = z
  .object({
    Courses: z.array(z.unknown()).optional().nullable(),
  })
  .passthrough();

const formattedMeetingSchema = z
  .object({
    InstructionalMethodCode: z.string().optional().nullable(),
    InstructionalMethodDisplay: z.string().optional().nullable(),
    Days: z.array(z.number()).optional().nullable(),
    StartTime: z.string().optional().nullable(),
    EndTime: z.string().optional().nullable(),
    StartTimeDisplay: z.string().optional().nullable(),
    EndTimeDisplay: z.string().optional().nullable(),
    Room: z.string().optional().nullable(),
    BuildingDisplay: z.string().optional().nullable(),
    RoomDisplay: z.string().optional().nullable(),
    StartDate: z.string().optional().nullable(),
    EndDate: z.string().optional().nullable(),
    IsOnline: z.boolean().optional().nullable(),
    ShowTBD: z.boolean().optional().nullable(),
  })
  .passthrough();

const upstreamSectionInnerSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).transform(String),
    Number: z.string().optional().nullable(),
    CourseName: z.string().optional().nullable(),
    Title: z.string().optional().nullable(),
    SectionNameDisplay: z.string().optional().nullable(),
    FullTitleDisplay: z.string().optional().nullable(),
    LocationDisplay: z.string().optional().nullable(),
    LocationCode: z.string().optional().nullable(),
    TermId: z.string().optional().nullable(),
    StartDate: z.string().optional().nullable(),
    EndDate: z.string().optional().nullable(),
    FormattedMeetingTimes: z.array(z.unknown()).optional().nullable(),
    Meetings: z.array(z.unknown()).optional().nullable(),
  })
  .passthrough();

export const upstreamSectionEnvelopeSchema = z
  .object({
    Section: upstreamSectionInnerSchema,
    FacultyDisplay: z.string().optional().nullable(),
    InstructorDetails: z.array(z.unknown()).optional().nullable(),
  })
  .passthrough();

export const upstreamSectionsResponseSchema = z
  .object({
    SectionsRetrieved: z
      .object({
        TermsAndSections: z
          .array(
            z
              .object({
                Term: z
                  .object({
                    Code: z.string().optional().nullable(),
                    Description: z.string().optional().nullable(),
                  })
                  .passthrough()
                  .optional()
                  .nullable(),
                Sections: z.array(z.unknown()).optional().nullable(),
              })
              .passthrough(),
          )
          .optional()
          .nullable(),
        Course: z.unknown().optional().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export const upstreamAdvancedSearchSchema = z
  .object({
    Terms: z
      .array(
        z.object({
          Item1: z.string(),
          Item2: z.string(),
        }),
      )
      .optional()
      .nullable(),
    Subjects: z
      .array(
        z
          .object({
            Code: z.string(),
            Description: z.string().optional().nullable(),
            ShowInCourseSearch: z.boolean().optional().nullable(),
          })
          .passthrough(),
      )
      .optional()
      .nullable(),
  })
  .passthrough();

export function parseCourseSummaries(raw: unknown): CourseSummary[] {
  const parsed = upstreamSearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[gryphcal] search response schema mismatch", parsed.error);
    throw new Error("Unexpected course search response from University of Guelph.");
  }

  const summaries: CourseSummary[] = [];
  for (const item of parsed.data.Courses ?? []) {
    const course = upstreamCourseSchema.safeParse(item);
    if (!course.success) {
      console.warn("[gryphcal] skipping malformed course summary", course.error);
      continue;
    }
    const c = course.data;
    summaries.push({
      id: c.Id,
      code: `${c.SubjectCode}*${c.Number}`,
      title: c.Title?.trim() || `${c.SubjectCode}*${c.Number}`,
      subjectCode: c.SubjectCode,
      number: c.Number,
      matchingSectionIds: c.MatchingSectionIds ?? [],
    });
  }
  return summaries;
}

export function parseCourseFromSectionsResponse(options: {
  term: string;
  courseId: string;
  courseCode: string;
  title?: string;
  description?: string;
  raw: unknown;
}): Course {
  const parsed = upstreamSectionsResponseSchema.safeParse(options.raw);
  if (!parsed.success) {
    console.error("[gryphcal] sections response schema mismatch", parsed.error);
    throw new Error("Unexpected section response from University of Guelph.");
  }

  const termsAndSections =
    parsed.data.SectionsRetrieved?.TermsAndSections ?? [];
  const sections: Section[] = [];

  for (const group of termsAndSections) {
    const termCode = group.Term?.Code ?? options.term;
    if (termCode && termCode !== options.term) {
      // Prefer matching term when multiple are present
    }
    for (const envelope of group.Sections ?? []) {
      try {
        const section = parseSectionEnvelope(envelope);
        if (section) sections.push(section);
      } catch (err) {
        console.warn("[gryphcal] skipping malformed section", err);
      }
    }
  }

  let title = options.title;
  const courseNode = parsed.data.SectionsRetrieved?.Course;
  if ((!title || !options.description) && courseNode && typeof courseNode === "object") {
    const c = courseNode as Record<string, unknown>;
    if (!title && typeof c.Title === "string") title = c.Title;
  }

  return {
    term: options.term,
    id: options.courseId,
    code: options.courseCode,
    title: title?.trim() || options.courseCode,
    description: options.description,
    sections,
  };
}

function parseSectionEnvelope(raw: unknown): Section | null {
  const envelope = upstreamSectionEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    console.warn("[gryphcal] section envelope invalid", envelope.error);
    return null;
  }

  const s = envelope.data.Section;
  const meetings = parseMeetings(s.FormattedMeetingTimes ?? s.Meetings ?? []);

  const number = s.Number?.trim() || extractSectionNumber(s.SectionNameDisplay) || s.Id;
  const displayName =
    s.SectionNameDisplay?.trim() ||
    (s.CourseName ? `${s.CourseName}*${number}` : number);

  const instructor = envelope.data.FacultyDisplay?.trim() || undefined;
  const delivery = inferDelivery(meetings, s.LocationCode, displayName);

  return {
    id: s.Id,
    displayName,
    number,
    instructor: instructor || undefined,
    deliveryMethod: delivery,
    meetings,
  };
}

function parseMeetings(rawMeetings: unknown[]): Meeting[] {
  const meetings: Meeting[] = [];
  for (const item of rawMeetings) {
    const parsed = formattedMeetingSchema.safeParse(item);
    if (!parsed.success) {
      // Fallback: try a looser object
      if (item && typeof item === "object") {
        const loose = parseLooseMeeting(item as Record<string, unknown>);
        if (loose) meetings.push(loose);
      }
      continue;
    }
    const m = parsed.data;
    const type =
      (m.InstructionalMethodCode || m.InstructionalMethodDisplay || "MTG").trim();
    const days = dayIndexesToWeekdays(m.Days ?? []);
    const startTime =
      parseTimeToHHmm(m.StartTime) || parseTimeToHHmm(m.StartTimeDisplay);
    const endTime =
      parseTimeToHHmm(m.EndTime) || parseTimeToHHmm(m.EndTimeDisplay);
    const location = formatLocation(m.Room, m.BuildingDisplay, m.RoomDisplay);
    const isOnline = Boolean(m.IsOnline);
    const isTBA =
      Boolean(m.ShowTBD) ||
      (!startTime && !endTime) ||
      (days.length === 0 && !isOnline && !startTime);

    meetings.push({
      type,
      typeLabel: instructionalMethodLabel(type),
      days,
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      location: location || undefined,
      startDate: toDateOnly(m.StartDate),
      endDate: toDateOnly(m.EndDate),
      isOnline,
      isTBA,
    });
  }
  return meetings;
}

function parseLooseMeeting(item: Record<string, unknown>): Meeting | null {
  const type = String(
    item.InstructionalMethodCode ?? item.InstructionalMethodDisplay ?? "MTG",
  );
  const daysRaw = Array.isArray(item.Days) ? (item.Days as number[]) : [];
  const days = dayIndexesToWeekdays(daysRaw);
  const startTime =
    parseTimeToHHmm(stringOrUndef(item.StartTime)) ||
    parseTimeToHHmm(stringOrUndef(item.StartTimeDisplay));
  const endTime =
    parseTimeToHHmm(stringOrUndef(item.EndTime)) ||
    parseTimeToHHmm(stringOrUndef(item.EndTimeDisplay));
  const isOnline = Boolean(item.IsOnline);
  const isTBA =
    Boolean(item.ShowTBD) || (!startTime && !endTime);

  return {
    type,
    typeLabel: instructionalMethodLabel(type),
    days,
    startTime: startTime ?? undefined,
    endTime: endTime ?? undefined,
    location:
      formatLocation(
        stringOrUndef(item.Room),
        stringOrUndef(item.BuildingDisplay),
        stringOrUndef(item.RoomDisplay),
      ) || undefined,
    startDate: toDateOnly(stringOrUndef(item.StartDate)),
    endDate: toDateOnly(stringOrUndef(item.EndDate)),
    isOnline,
    isTBA,
  };
}

function formatLocation(
  room?: string | null,
  buildingDisplay?: string | null,
  roomDisplay?: string | null,
): string {
  if (room && room.replace(/\*/g, "").trim()) {
    return room.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  }
  const parts = [buildingDisplay, roomDisplay]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join(" ");
}

function toDateOnly(value?: string | null): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function extractSectionNumber(display?: string | null): string | undefined {
  if (!display) return undefined;
  const m = display.match(/\*([A-Z0-9]+)$/);
  return m?.[1];
}

function inferDelivery(
  meetings: Meeting[],
  locationCode?: string | null,
  displayName?: string,
): string | undefined {
  if (displayName?.includes("*DE") || /DE\d+/i.test(displayName ?? "")) {
    return "Distance Education";
  }
  if (meetings.some((m) => m.isOnline) && meetings.every((m) => m.isTBA || m.isOnline)) {
    return "Online";
  }
  if (locationCode) return locationCode;
  return undefined;
}

function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function assertJsonObject(raw: unknown): Record<string, unknown> {
  const result = looseRecord.safeParse(raw);
  if (!result.success) {
    throw new Error("Expected a JSON object from University of Guelph.");
  }
  return result.data;
}
