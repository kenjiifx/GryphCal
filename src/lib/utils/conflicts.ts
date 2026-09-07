import type { Meeting, SelectedSection, Weekday } from "@/lib/guelph/types";
import { timeToMinutes } from "@/lib/utils/times";

export interface TimetableBlock {
  key: string;
  term: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string;
  sectionNumber: string;
  meetingIndex: number;
  type: string;
  typeLabel: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  location?: string;
  colorIndex: number;
}

export interface ConflictPair {
  a: TimetableBlock;
  b: TimetableBlock;
}

export function selectedToBlocks(
  selected: SelectedSection[],
): TimetableBlock[] {
  const blocks: TimetableBlock[] = [];

  selected.forEach((item, colorIndex) => {
    item.section.meetings.forEach((meeting, meetingIndex) => {
      if (!isSchedulable(meeting)) return;
      for (const day of meeting.days) {
        blocks.push({
          key: `${item.section.id}-${meetingIndex}-${day}`,
          term: item.term,
          courseCode: item.courseCode,
          courseTitle: item.courseTitle,
          sectionId: item.section.id,
          sectionNumber: item.section.number,
          meetingIndex,
          type: meeting.type,
          typeLabel: meeting.typeLabel,
          day,
          startTime: meeting.startTime!,
          endTime: meeting.endTime!,
          location: meeting.location,
          colorIndex,
        });
      }
    });
  });

  return blocks;
}

export function isSchedulable(meeting: Meeting): boolean {
  return (
    !meeting.isTBA &&
    Boolean(meeting.startTime) &&
    Boolean(meeting.endTime) &&
    meeting.days.length > 0
  );
}

export function findConflicts(blocks: TimetableBlock[]): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.day !== b.day) continue;
      if (a.sectionId === b.sectionId && a.meetingIndex === b.meetingIndex) {
        continue;
      }
      if (rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false;
  return a0 < b1 && b0 < a1;
}
