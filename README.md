# GryphCal

Turn your University of Guelph timetable into a calendar in seconds.

Students pick a semester, search live course offerings, select the section they are enrolled in, preview conflicts, and download a standards-compliant `.ics` file for Google Calendar, Apple Calendar, Outlook, or any RFC 5545 calendar.


## What’s new (UX)

- Distinctive Gryphon crimson UI (not a generic dashboard)
- Bulk paste course codes (`CIS*2030`, `CIS 2430`, …)
- Auto-save in this browser + copyable share links (still no accounts)
- Conflict highlighting on the weekly grid
- Toasts + clearer empty/loading/error states


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
