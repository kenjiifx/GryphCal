"use client";

import type { Course } from "@/lib/guelph/types";
import { isSchedulable } from "@/lib/utils/conflicts";
import { formatTime12h } from "@/lib/utils/times";
import { formatWeekdays } from "@/lib/utils/weekdays";

interface Props {
  course: Course;
  selectedSectionId?: string;
  onAdd: (sectionId: string) => void;
}

export function SectionPicker({ course, selectedSectionId, onAdd }: Props) {
  return (
    <section className="panel">
      <h2>
        {course.code}
        <span className="panel-subtitle">{course.title}</span>
      </h2>
      {course.sections.length === 0 ? (
        <p className="muted">No sections were returned for this course.</p>
      ) : (
        <ul className="section-list">
          {course.sections.map((section) => {
            const hasTimed = section.meetings.some(isSchedulable);
            const isSelected = selectedSectionId === section.id;
            return (
              <li
                key={section.id}
                className={`section-card${isSelected ? " is-selected" : ""}`}
              >
                <div className="section-head">
                  <div>
                    <strong>Section {section.number}</strong>
                    <div className="muted small">
                      {section.displayName}
                      {section.instructor ? ` · ${section.instructor}` : ""}
                      {section.deliveryMethod
                        ? ` · ${section.deliveryMethod}`
                        : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    disabled={isSelected}
                    onClick={() => onAdd(section.id)}
                  >
                    {isSelected ? "In timetable" : "Add section"}
                  </button>
                </div>
                <ul className="meeting-list">
                  {section.meetings.map((meeting, idx) => (
                    <li key={`${section.id}-${idx}`}>
                      <span className="badge">{meeting.type}</span>
                      {isSchedulable(meeting) ? (
                        <span>
                          {formatWeekdays(meeting.days)} ·{" "}
                          {formatTime12h(meeting.startTime!)} –{" "}
                          {formatTime12h(meeting.endTime!)}
                          {meeting.location ? ` · ${meeting.location}` : ""}
                        </span>
                      ) : (
                        <span className="muted">No scheduled weekly meeting</span>
                      )}
                    </li>
                  ))}
                  {section.meetings.length === 0 && (
                    <li className="muted">No scheduled weekly meeting</li>
                  )}
                </ul>
                {!hasTimed && section.meetings.length > 0 && (
                  <p className="muted small">
                    Shown in your list, but won’t create timed calendar events.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
