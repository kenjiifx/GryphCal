"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Course,
  CourseSummary,
  SelectedSection,
  Term,
} from "@/lib/guelph/types";
import { generateIcs } from "@/lib/calendar/generate";
import { findConflicts, selectedToBlocks } from "@/lib/utils/conflicts";
import { parseBulkCourseCodes } from "@/lib/utils/bulkCodes";
import {
  clearPersistedState,
  loadPersistedState,
  readShareFromLocation,
  savePersistedState,
  writeShareToLocation,
} from "@/lib/utils/persist";
import { CourseSearch } from "@/components/CourseSearch";
import { SectionPicker } from "@/components/SectionPicker";
import { SelectedPanel } from "@/components/SelectedPanel";
import { WeeklyPreview } from "@/components/WeeklyPreview";

export function GryphCalApp() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [term, setTerm] = useState<string>("");
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelectedSection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const loadTerms = useCallback(async () => {
    setTermsLoading(true);
    setTermsError(null);
    try {
      const res = await fetch("/api/terms");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load terms.");
      setTerms(data.terms);
      setTerm((current) => current || data.terms[0]?.code || "");
    } catch (err) {
      setTermsError(err instanceof Error ? err.message : "Failed to load terms.");
    } finally {
      setTermsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    const shared = readShareFromLocation();
    const saved = shared ?? loadPersistedState();
    if (saved) {
      setTerm(saved.term);
      setSelected(saved.selected);
      if (shared) showToast("Loaded shared timetable");
    }
    setHydrated(true);
  }, [showToast]);

  useEffect(() => {
    if (!hydrated || !term) return;
    savePersistedState({ term, selected });
  }, [hydrated, term, selected]);

  const fetchCourse = useCallback(
    async (code: string): Promise<Course> => {
      const res = await fetch(
        `/api/courses/${encodeURIComponent(code)}?term=${encodeURIComponent(term)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load ${code}.`);
      return data.course as Course;
    },
    [term],
  );

  const openCourse = useCallback(
    async (summary: CourseSummary) => {
      if (!term) return;
      setCourseLoading(true);
      setCourseError(null);
      try {
        const course = await fetchCourse(summary.code);
        setActiveCourse(course);
        // Sections sit right under search once results collapse — nudge into view.
        window.requestAnimationFrame(() => {
          document.getElementById("sections-panel")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      } catch (err) {
        setActiveCourse(null);
        setCourseError(
          err instanceof Error ? err.message : "Failed to load sections.",
        );
      } finally {
        setCourseLoading(false);
      }
    },
    [term, fetchCourse],
  );

  const addSection = useCallback(
    (course: Course, sectionId: string, quiet = false) => {
      const section = course.sections.find((s) => s.id === sectionId);
      if (!section) return;
      setSelected((prev) => {
        const withoutSameCourse = prev.filter(
          (p) => !(p.term === course.term && p.courseCode === course.code),
        );
        return [
          ...withoutSameCourse,
          {
            term: course.term,
            courseId: course.id,
            courseCode: course.code,
            courseTitle: course.title,
            section,
          },
        ];
      });
      if (!quiet) showToast(`Added ${course.code} · ${section.number}`);
    },
    [showToast],
  );

  const removeSelected = useCallback(
    (sectionId: string) => {
      setSelected((prev) => prev.filter((s) => s.section.id !== sectionId));
    },
    [],
  );

  const clearAll = useCallback(() => {
    setSelected([]);
    clearPersistedState();
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    showToast("Cleared timetable");
  }, [showToast]);

  const bulkAdd = useCallback(
    async (raw: string) => {
      if (!term) return;
      const codes = parseBulkCourseCodes(raw);
      if (!codes.length) {
        showToast("No valid course codes found");
        return;
      }
      setBulkBusy(true);
      let added = 0;
      const failures: string[] = [];
      try {
        for (const code of codes.slice(0, 12)) {
          try {
            const course = await fetchCourse(code);
            if (!course.sections.length) {
              failures.push(code);
              continue;
            }
            // Prefer first timed section; otherwise first section
            const preferred =
              course.sections.find((s) =>
                s.meetings.some((m) => !m.isTBA && m.startTime),
              ) ?? course.sections[0];
            addSection(course, preferred.id, true);
            added += 1;
            setActiveCourse(course);
          } catch {
            failures.push(code);
          }
        }
        if (added) {
          showToast(
            failures.length
              ? `Added ${added}. Couldn’t load: ${failures.join(", ")}`
              : `Added ${added} course${added === 1 ? "" : "s"} — pick exact sections if needed`,
          );
        } else {
          showToast(`Couldn’t load: ${failures.join(", ") || "those codes"}`);
        }
      } finally {
        setBulkBusy(false);
      }
    },
    [term, fetchCourse, addSection, showToast],
  );

  const blocks = useMemo(() => selectedToBlocks(selected), [selected]);
  const conflicts = useMemo(() => findConflicts(blocks), [blocks]);
  const conflictKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of conflicts) {
      keys.add(c.a.key);
      keys.add(c.b.key);
    }
    return keys;
  }, [conflicts]);

  const downloadIcs = useCallback(() => {
    try {
      if (!selected.length) return;
      // Generate in-browser so your schedule never hits our server.
      const ics = generateIcs({ selected });
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gryphcal-${(term || "schedule").toLowerCase()}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Calendar downloaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed");
    }
  }, [selected, term, showToast]);

  const copyShareLink = useCallback(async () => {
    if (!term) return;
    const url = writeShareToLocation({ term, selected });
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied — no login needed");
    } catch {
      showToast("Share link updated in the address bar");
    }
  }, [term, selected, showToast]);

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand-mark">
          <div className="brand-glyph" aria-hidden>
            G
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>GryphCal</div>
            <div className="muted small">University of Guelph</div>
          </div>
        </div>
        <div className="privacy-chip">No login · stays on your device</div>
      </div>

      <header className="hero">
        <div>
          <h1>
            Gryph<span>Cal</span>
          </h1>
          <p className="subtitle">
            Search live F26 / W27 offerings, pick your sections, and download a
            calendar file. Built to be fast — not another account wall.
          </p>
        </div>
        <div className="term-card">
          <label htmlFor="term">Semester</label>
          {termsLoading ? (
            <div className="skeleton" style={{ height: "2.75rem" }} />
          ) : termsError ? (
            <div className="error-box">
              <p>{termsError}</p>
              <button type="button" onClick={() => void loadTerms()}>
                Retry
              </button>
            </div>
          ) : (
            <select
              id="term"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setActiveCourse(null);
                setSelected([]);
              }}
            >
              {terms.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className="steps" aria-hidden={false}>
        <div className="step">
          <strong>1 · Search</strong>
          Course code or paste a whole list
        </div>
        <div className="step">
          <strong>2 · Pick section</strong>
          Lectures, labs, seminars — as Guelph lists them
        </div>
        <div className="step">
          <strong>3 · Download</strong>
          `.ics` for Google, Apple, Outlook
        </div>
      </div>

      <div className="layout-grid">
        <main>
          <CourseSearch
            term={term}
            disabled={!term || Boolean(termsError)}
            onSelect={openCourse}
            onClearCourse={() => {
              setActiveCourse(null);
              setCourseError(null);
            }}
            onBulkAdd={(raw) => void bulkAdd(raw)}
            bulkBusy={bulkBusy}
          />

          {(courseLoading || courseError || (activeCourse && !courseLoading)) && (
            <div id="sections-panel" className="sections-anchor">
              {courseLoading && (
                <div className="panel">
                  <div className="skeleton" />
                  <p className="muted" style={{ marginTop: "0.75rem" }}>
                    Loading sections…
                  </p>
                </div>
              )}
              {courseError && (
                <div className="error-box panel">
                  <p>{courseError}</p>
                  <button type="button" onClick={() => setCourseError(null)}>
                    Dismiss
                  </button>
                </div>
              )}
              {activeCourse && !courseLoading && (
                <SectionPicker
                  course={activeCourse}
                  selectedSectionId={
                    selected.find(
                      (s) =>
                        s.courseCode === activeCourse.code &&
                        s.term === activeCourse.term,
                    )?.section.id
                  }
                  onAdd={(sectionId) => addSection(activeCourse, sectionId)}
                />
              )}
            </div>
          )}

          <WeeklyPreview blocks={blocks} conflictKeys={conflictKeys} />
        </main>

        <aside>
          <SelectedPanel
            selected={selected}
            conflicts={conflicts}
            onRemove={removeSelected}
            onDownload={downloadIcs}
            onShare={() => void copyShareLink()}
            onClear={clearAll}
          />
        </aside>
      </div>

      <p className="footer-note">
        Uses the public University of Guelph course catalog. Your selected
        timetable is stored only in this browser unless you copy a share link.
      </p>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
