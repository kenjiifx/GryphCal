# GryphCal

Turn your University of Guelph timetable into a calendar in seconds.

Students pick a semester, search live course offerings, select the section they are enrolled in, preview conflicts, and download a standards-compliant `.ics` file for Google Calendar, Apple Calendar, Outlook, or any RFC 5545 calendar.


## What’s new (UX)

- Distinctive Gryphon crimson UI (not a generic dashboard)
- Bulk paste course codes (`CIS*2030`, `CIS 2430`, …)
- Auto-save in this browser + copyable share links (still no accounts)
- Conflict highlighting on the weekly grid
- Toasts + clearer empty/loading/error states

## Architecture

- **Next.js (App Router) + TypeScript + React + Tailwind CSS**
- Server Route Handlers proxy all University requests (avoids browser CORS and keeps parsing server-side)
- `CourseProvider` abstraction so the UI does not know about WebAdvisor/Colleague internals
- `zod` validation of upstream JSON + persisted/share payloads
- In-memory server cache (terms ~6h, search/sections ~4h, CSRF ~10m)
- API rate limits + security headers (CSP, frame deny, nosniff, …)
- `ical-generator` + `luxon` for `America/Toronto` calendars (client-side download)

```
src/
  app/                  # UI + API routes
  components/           # Search, sections, preview, selected panel
  lib/guelph/           # Provider, Colleague SS client, parser, types
  lib/calendar/         # ICS generation + curated academic dates
  lib/utils/            # Course codes, weekdays, times, conflicts
tests/                  # Unit + fixture integration tests
tests/fixtures/         # Sanitized real F26/W27 upstream responses
```

## Data source

GryphCal reads the **public Ellucian Colleague Self-Service Course Catalog** used by University of Guelph WebAdvisor:

**Base:** `https://colleague-ss.uoguelph.ca`

| Step | Method | Path |
| --- | --- | --- |
| Bootstrap antiforgery | GET | `/Student/Courses` |
| Discover terms / subjects | GET | `/Student/Courses/GetCatalogAdvancedSearch` |
| Search courses | POST JSON | `/Student/Courses/PostSearchCriteria` |
| Load section meetings | POST JSON | `/Student/Courses/Sections` |

Public catalog access uses only:

1. Cookie: `.ColleagueSelfServiceAntiforgery`
2. Header: `__RequestVerificationToken` (from the Courses HTML form field)

No credentials are stored or committed.

### Term support

Terms are discovered at runtime from `GetCatalogAdvancedSearch` (currently `F26` / Fall 2026 and `W27` / Winter 2027). Adding a future semester does not require redesigning the app—once Guelph lists it upstream it appears in the dropdown. Optional class-date bounds and `EXDATE` holidays live in `src/lib/calendar/academicDates.ts` separately from course parsing.

### Parsing notes

- Prefer `FormattedMeetingTimes` (wall-clock times) over raw `Meetings` UTC fields
- Normalize into `Course` → `Section` → `Meeting`
- DE / TBA / empty times are kept in the UI as “No scheduled weekly meeting” and **do not** create fake timed `.ics` events

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Vitest unit + fixture tests |
| `npm run build` | Production build |
| `npm run smoke` | Optional live check against Guelph (not CI) |

## Testing

Automated tests use **saved sanitized fixtures** from live F26/W27 responses so CI does not depend on University uptime:

- Course code normalization
- Weekday / time parsing
- Upstream normalization (CIS*2030 multi-component, W27 CIS*1500, FRHD DE/TBA)
- Conflict detection
- ICS generation (RRULE, timezone, DE skip, deterministic UIDs)

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import the project in Vercel
3. Deploy (no environment variables required)

Build command: `npm run build`  
Output: Next.js default

## Known limitations

- **Makeup / rescheduled class days** (for example F26 Dec 3–4, W27 Apr 12) are not expanded as extra occurrences in v1
- Upstream section `EndDate` often extends into the exam period; GryphCal clamps recurrence `UNTIL` using curated last-regular-class dates when available
- Holiday / study-break `EXDATE` entries exist only for curated dates in `academicDates.ts`—they are not invented beyond the official Schedule of Dates
- Seat availability is not a product focus; catalog data can change as Guelph updates offerings
- Be polite to University servers—responses are cached server-side

## License

Personal / student utility. University of Guelph course data remains subject to the University’s terms of use. Use the public catalog responsibly.
