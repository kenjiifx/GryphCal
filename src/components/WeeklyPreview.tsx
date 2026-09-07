"use client";

import type { TimetableBlock } from "@/lib/utils/conflicts";
import type { Weekday } from "@/lib/guelph/types";
import { timeToMinutes } from "@/lib/utils/times";
import { courseColor } from "@/components/SelectedPanel";

const DAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];
const DAY_LABELS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
};

const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const RANGE = DAY_END - DAY_START;

interface Props {
  blocks: TimetableBlock[];
  conflictKeys?: Set<string>;
}

export function WeeklyPreview({ blocks, conflictKeys }: Props) {
  const weekdayBlocks = blocks.filter((b) => DAYS.includes(b.day));

  return (
    <section className="panel">
      <h2>Week at a glance</h2>
      {weekdayBlocks.length === 0 ? (
        <p className="muted">
          Your timed meetings land here Monday–Friday once you add sections.
        </p>
      ) : (
        <div
          className="timetable"
          role="grid"
          aria-label="Weekly timetable preview"
        >
          {DAYS.map((day) => (
            <div key={day} className="timetable-day" role="row">
              <div className="timetable-day-label">{DAY_LABELS[day]}</div>
              <div className="timetable-track">
                {weekdayBlocks
                  .filter((b) => b.day === day)
                  .map((block) => {
                    const start = timeToMinutes(block.startTime) ?? DAY_START;
                    const end = timeToMinutes(block.endTime) ?? start + 60;
                    const top =
                      ((Math.max(start, DAY_START) - DAY_START) / RANGE) * 100;
                    const height =
                      ((Math.min(end, DAY_END) - Math.max(start, DAY_START)) /
                        RANGE) *
                      100;
                    const conflict = conflictKeys?.has(block.key);
                    return (
                      <div
                        key={block.key}
                        className={`timetable-block${conflict ? " is-conflict" : ""}`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(height, 4)}%`,
                          background: courseColor(block.colorIndex),
                        }}
                        title={`${block.courseCode} ${block.typeLabel}${conflict ? " (conflict)" : ""}`}
                      >
                        <strong>{block.courseCode}</strong>
                        <span>
                          {block.type} {block.startTime}–{block.endTime}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
