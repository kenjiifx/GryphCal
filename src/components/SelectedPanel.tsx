"use client";

import type { ConflictPair } from "@/lib/utils/conflicts";
import type { SelectedSection } from "@/lib/guelph/types";
import { isSchedulable } from "@/lib/utils/conflicts";
import { formatTime12h } from "@/lib/utils/times";
import { formatWeekdays } from "@/lib/utils/weekdays";

interface Props {
  selected: SelectedSection[];
  conflicts: ConflictPair[];
  onRemove: (sectionId: string) => void;
  onDownload: () => void;
  onShare: () => void;
  onClear: () => void;
}

export function SelectedPanel({
  selected,
  conflicts,
  onRemove,
  onDownload,
  onShare,
  onClear,
}: Props) {
  return (
    <section className="panel sticky-panel">
      <h2>Your timetable</h2>
      <p className="hint small">
        Auto-saved in this browser. Share with a link — still no account.
      </p>

      {selected.length === 0 ? (
        <p className="muted">Add sections and your week will show up here.</p>
      ) : (
        <ul className="selected-list">
          {selected.map((item, index) => (
            <li key={item.section.id} className="selected-item">
              <div className="selected-head">
                <span
                  className="color-dot"
                  style={{ background: courseColor(index) }}
                  aria-hidden
                />
                <div>
                  <strong>{item.courseCode}</strong>
                  <div className="muted small">
                    Section {item.section.number}
                    {item.section.instructor
                      ? ` · ${item.section.instructor}`
                      : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => onRemove(item.section.id)}
                >
                  Remove
                </button>
              </div>
              <ul className="meeting-list compact">
                {item.section.meetings.map((m, i) => (
                  <li key={i}>
                    <span className="badge">{m.type}</span>
                    {isSchedulable(m) ? (
                      <span>
                        {formatWeekdays(m.days)} {formatTime12h(m.startTime!)}–
                        {formatTime12h(m.endTime!)}
                      </span>
                    ) : (
                      <span className="muted">No scheduled weekly meeting</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {conflicts.length > 0 ? (
        <div className="warning-box">
          <strong>
            {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
          </strong>
          <ul>
            {conflicts.slice(0, 6).map((c, i) => (
              <li key={i}>
                {c.a.courseCode} {c.a.type} overlaps {c.b.courseCode} {c.b.type}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        selected.length > 0 && (
          <div className="ok-box">No obvious time conflicts</div>
        )
      )}

      <button
        type="button"
        className="primary download"
        disabled={selected.length === 0}
        onClick={onDownload}
      >
        Download .ics
      </button>

      <div className="action-row">
        <button
          type="button"
          className="ghost"
          disabled={selected.length === 0}
          onClick={onShare}
        >
          Copy share link
        </button>
        <button
          type="button"
          className="ghost"
          disabled={selected.length === 0}
          onClick={onClear}
        >
          Clear all
        </button>
      </div>

      <p className="hint small" style={{ marginTop: "0.85rem", marginBottom: 0 }}>
        Import into Google Calendar, Apple Calendar, or Outlook. Generated on
        your device.
      </p>
    </section>
  );
}

export function courseColor(index: number): string {
  const colors = [
    "#c8102e",
    "#1f4d3a",
    "#1d4f91",
    "#7c2d12",
    "#5b2d8e",
    "#0f5f6a",
  ];
  return colors[index % colors.length];
}
