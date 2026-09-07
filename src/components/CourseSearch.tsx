"use client";

import { useEffect, useRef, useState } from "react";
import type { CourseSummary } from "@/lib/guelph/types";

interface Props {
  term: string;
  disabled?: boolean;
  onSelect: (course: CourseSummary) => void;
  onClearCourse?: () => void;
  onBulkAdd: (raw: string) => void;
  bulkBusy?: boolean;
}

export function CourseSearch({
  term,
  disabled,
  onSelect,
  onClearCourse,
  onBulkAdd,
  bulkBusy,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [picked, setPicked] = useState<CourseSummary | null>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (disabled || !term) return;

    // After picking a course we may sync the input to its code — don't re-expand results.
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    // Editing search means they want the list back (misclick / change course).
    if (picked) {
      setPicked(null);
      onClearCourse?.();
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/courses/search?term=${encodeURIComponent(term)}&q=${encodeURIComponent(trimmed)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        setResults(data.courses ?? []);
        setSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-search when query/term change
  }, [query, term, disabled]);

  useEffect(() => {
    // New semester → reset pick
    setPicked(null);
    setResults([]);
    setSearched(false);
  }, [term]);

  function handlePick(course: CourseSummary) {
    setPicked(course);
    skipNextSearch.current = true;
    setQuery(course.code);
    setResults([]);
    setSearched(false);
    setError(null);
    onSelect(course);
  }

  function handleChangeCourse() {
    setPicked(null);
    onClearCourse?.();
    // Keep current query so results come back for the same subject browse
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      // Force a fresh search for the current text
      skipNextSearch.current = false;
      setQuery(trimmed);
      // Trigger effect by slight bump if query already equals trimmed
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/courses/search?term=${encodeURIComponent(term)}&q=${encodeURIComponent(trimmed)}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Search failed.");
          setResults(data.courses ?? []);
          setSearched(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed.");
          setResults([]);
          setSearched(true);
        } finally {
          setLoading(false);
        }
      })();
    }
  }

  const showResults = !picked && !loading;

  return (
    <section className="panel" id="search-panel">
      <h2>Find courses</h2>
      <p className="hint">
        Any Guelph subject works — <code>MATH*1210</code>, <code>ENGG1500</code>,{" "}
        <code>PSYC</code>, or a title like <code>organic chemistry</code>. Paste a
        whole list if you want.
      </p>
      <div className="search-row">
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Search by code or name"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search courses"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="bulk-toggle"
          onClick={() => setShowBulk((v) => !v)}
        >
          {showBulk ? "Hide bulk paste" : "Paste multiple course codes"}
        </button>
      </div>

      {showBulk && (
        <div className="bulk-box">
          <textarea
            rows={3}
            value={bulkText}
            disabled={disabled || bulkBusy}
            placeholder={"CIS*2030\nCIS*2430\nCIS*2520"}
            onChange={(e) => setBulkText(e.target.value)}
            aria-label="Paste multiple course codes"
          />
          <div className="bulk-actions">
            <button
              type="button"
              className="primary"
              disabled={disabled || bulkBusy || !bulkText.trim()}
              onClick={() => onBulkAdd(bulkText)}
            >
              {bulkBusy ? "Adding…" : "Add list"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={bulkBusy}
              onClick={() => setBulkText("")}
            >
              Clear
            </button>
          </div>
          <p className="muted small">
            Adds the first available section for each code — switch sections
            afterward if needed. Max 12 at a time.
          </p>
        </div>
      )}

      {picked && (
        <div className="picked-course" role="status">
          <div>
            <div className="code">{picked.code}</div>
            <div className="title">{picked.title}</div>
            <div className="muted small">
              Showing sections below · edit search to pick a different course
            </div>
          </div>
          <button type="button" className="ghost" onClick={handleChangeCourse}>
            Change
          </button>
        </div>
      )}

      {loading && <p className="muted">Searching…</p>}
      {error && !picked && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}
      {showResults && searched && !error && results.length === 0 && (
        <p className="muted">
          No courses matched “{query.trim()}” for this semester.
        </p>
      )}
      {showResults && results.length > 0 && (
        <ul className="result-list">
          {results.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className="result-button"
                onClick={() => handlePick(course)}
              >
                <span className="code">{course.code}</span>
                <span className="title">{course.title}</span>
                <span className="meta">
                  {course.matchingSectionIds.length} section
                  {course.matchingSectionIds.length === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
