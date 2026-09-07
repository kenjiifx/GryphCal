import {
  parseCourseFromSectionsResponse,
  parseCourseSummaries,
  upstreamAdvancedSearchSchema,
} from "@/lib/guelph/parser";
import { normalizeTerms } from "@/lib/guelph/terms";
import type {
  Course,
  CourseProvider,
  CourseSummary,
  Term,
} from "@/lib/guelph/types";
import {
  normalizeCourseCode,
  parseSearchQuery,
  splitCourseCode,
} from "@/lib/utils/courseCode";

const BASE_URL = "https://colleague-ss.uoguelph.ca";
const USER_AGENT =
  "GryphCal/1.0 (University of Guelph timetable to ICS; +https://github.com/)";

const TERMS_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 4 * 60 * 60 * 1000;
const SECTIONS_TTL_MS = 4 * 60 * 60 * 1000;
const CSRF_TTL_MS = 10 * 60 * 1000;
const PAGE_SIZE = 50;
const MAX_PAGES = 4;

interface CacheEntry<T> {
  expires: number;
  value: T;
}

interface CsrfSession {
  cookie: string;
  token: string;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  memoryCache.set(key, { value, expires: Date.now() + ttlMs });
}

export function clearProviderCache(): void {
  memoryCache.clear();
}

async function bootstrapCsrf(): Promise<CsrfSession> {
  const cached = cacheGet<CsrfSession>("csrf");
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/Student/Courses`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Unable to reach University of Guelph course catalog (${res.status}).`,
    );
  }

  const html = await res.text();
  const tokenMatch = html.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/,
  );
  if (!tokenMatch?.[1]) {
    console.error("[gryphcal] CSRF token missing from Courses page");
    throw new Error("University catalog antiforgery token was not found.");
  }

  const setCookies = getSetCookieHeaders(res);
  const antiforgery = setCookies
    .map(parseSetCookie)
    .find((c) => c?.name === ".ColleagueSelfServiceAntiforgery");

  if (!antiforgery?.value) {
    console.error("[gryphcal] antiforgery cookie missing");
    throw new Error("University catalog session cookie was not found.");
  }

  const session: CsrfSession = {
    cookie: `.ColleagueSelfServiceAntiforgery=${antiforgery.value}`,
    token: tokenMatch[1],
  };
  cacheSet("csrf", session, CSRF_TTL_MS);
  return session;
}

function getSetCookieHeaders(res: Response): string[] {
  const headers = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseSetCookie(
  header: string,
): { name: string; value: string } | null {
  const part = header.split(";")[0];
  const eq = part.indexOf("=");
  if (eq <= 0) return null;
  return {
    name: part.slice(0, eq).trim(),
    value: part.slice(eq + 1).trim(),
  };
}

async function guelphFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const session = await bootstrapCsrf();
  const headers = new Headers(init.headers);
  headers.set("User-Agent", USER_AGENT);
  headers.set("__RequestVerificationToken", session.token);
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("Cookie", session.cookie);
  headers.set("Accept", "application/json");

  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body,
    cache: "no-store",
  });

  if (res.status === 400) {
    const text = await res.text();
    if (/antiforgery/i.test(text)) {
      memoryCache.delete("csrf");
      const retrySession = await bootstrapCsrf();
      headers.set("__RequestVerificationToken", retrySession.token);
      headers.set("Cookie", retrySession.cookie);
      return fetch(`${BASE_URL}${path}`, {
        ...init,
        headers,
        body,
        cache: "no-store",
      });
    }
    throw new Error(text || "Bad request to University catalog.");
  }

  return res;
}

async function guelphJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const res = await guelphFetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[gryphcal] upstream ${path} failed`,
      res.status,
      text.slice(0, 200),
    );
    throw new Error(
      `University of Guelph catalog request failed (${res.status}).`,
    );
  }
  return (await res.json()) as T;
}

export class ColleagueSelfServiceProvider implements CourseProvider {
  async getTerms(): Promise<Term[]> {
    const meta = await this.getCatalogMeta();
    return meta.terms;
  }

  async searchCourses(term: string, query: string): Promise<CourseSummary[]> {
    const termCode = term.trim().toUpperCase();
    if (!termCode || !query.trim()) return [];

    const meta = await this.getCatalogMeta();
    const parsed = parseSearchQuery(query, {
      knownSubjects: meta.subjects,
    });
    if (!parsed.raw) return [];

    const cacheKey = `search:${termCode}:${parsed.kind}:${parsed.raw.toUpperCase()}`;
    const cached = cacheGet<CourseSummary[]>(cacheKey);
    if (cached) return cached;

    let summaries = await this.runSearch(termCode, buildCriteriaFor(parsed));

    if (parsed.kind === "code" && !hasExactCode(summaries, parsed.code)) {
      const viaComponents = await this.runSearch(
        termCode,
        buildKeywordComponentCriteria(parsed.subject, parsed.number),
      );
      if (viaComponents.length) summaries = viaComponents;
    }

    if (parsed.kind === "code") {
      const exact = summaries.filter(
        (c) =>
          c.code === parsed.code ||
          (c.subjectCode === parsed.subject && c.number === parsed.number),
      );
      if (exact.length) summaries = exact;
    }

    if (parsed.kind === "subject") {
      const filtered = summaries.filter(
        (c) => c.subjectCode === parsed.subject,
      );
      if (filtered.length) summaries = filtered;
    }

    cacheSet(cacheKey, summaries, SEARCH_TTL_MS);
    return summaries;
  }

  async getCourseSections(term: string, courseCode: string): Promise<Course> {
    const termCode = term.trim().toUpperCase();
    const code =
      normalizeCourseCode(courseCode) || courseCode.trim().toUpperCase();
    if (!termCode || !code) {
      throw new Error("Term and course code are required.");
    }

    const cacheKey = `sections:${termCode}:${code}`;
    const cached = cacheGet<Course>(cacheKey);
    if (cached) return cached;

    const matches = await this.searchCourses(termCode, code);
    const split = splitCourseCode(code);
    const summary =
      matches.find(
        (c) =>
          c.code === code ||
          (split &&
            c.subjectCode === split.subject &&
            c.number === split.number),
      ) ?? matches[0];

    if (!summary) {
      throw new Error(`No sections found for ${code} in ${termCode}.`);
    }

    if (!summary.matchingSectionIds.length) {
      return {
        term: termCode,
        id: summary.id,
        code: summary.code,
        title: summary.title,
        sections: [],
      };
    }

    const raw = await guelphJson<unknown>("/Student/Courses/Sections", {
      method: "POST",
      json: {
        courseId: summary.id,
        sectionIds: summary.matchingSectionIds,
      },
    });

    const course = parseCourseFromSectionsResponse({
      term: termCode,
      courseId: summary.id,
      courseCode: summary.code,
      title: summary.title,
      raw,
    });

    cacheSet(cacheKey, course, SECTIONS_TTL_MS);
    return course;
  }

  private async getCatalogMeta(): Promise<{
    terms: Term[];
    subjects: Set<string>;
  }> {
    const cached = cacheGet<{ terms: Term[]; subjects: string[] }>(
      "catalog-meta",
    );
    if (cached) {
      return { terms: cached.terms, subjects: new Set(cached.subjects) };
    }

    const raw = await guelphJson<unknown>(
      "/Student/Courses/GetCatalogAdvancedSearch",
      { method: "GET" },
    );
    const parsed = upstreamAdvancedSearchSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[gryphcal] catalog meta schema mismatch", parsed.error);
      throw new Error("Unexpected catalog metadata from University of Guelph.");
    }

    const terms = normalizeTerms(parsed.data.Terms ?? []);
    if (terms.length === 0) {
      throw new Error("No terms are currently listed in the course catalog.");
    }

    const subjects = (parsed.data.Subjects ?? [])
      .map((s) => s.Code?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code));

    cacheSet("catalog-meta", { terms, subjects }, TERMS_TTL_MS);
    cacheSet("terms", terms, TERMS_TTL_MS);

    return { terms, subjects: new Set(subjects) };
  }

  private async runSearch(
    termCode: string,
    baseCriteria: Record<string, unknown>,
  ): Promise<CourseSummary[]> {
    const all: CourseSummary[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const raw = await guelphJson<unknown>(
        "/Student/Courses/PostSearchCriteria",
        {
          method: "POST",
          json: {
            ...baseCriteria,
            terms: [termCode],
            pageNumber: page,
            quantityPerPage: PAGE_SIZE,
          },
        },
      );

      const pageSummaries = parseCourseSummaries(raw);
      if (!pageSummaries.length) break;

      for (const course of pageSummaries) {
        if (seen.has(course.id)) continue;
        seen.add(course.id);
        all.push(course);
      }

      if (pageSummaries.length < PAGE_SIZE) break;
    }

    return all;
  }
}

function buildCriteriaFor(parsed: ReturnType<typeof parseSearchQuery>) {
  if (parsed.kind === "code") {
    return {
      keyword: parsed.code,
      subjects: [] as string[],
    };
  }

  if (parsed.kind === "subject") {
    return {
      keyword: "",
      subjects: [parsed.subject],
    };
  }

  return {
    keyword: parsed.text,
    subjects: [] as string[],
  };
}

function buildKeywordComponentCriteria(subject: string, number: string) {
  return {
    keyword: "",
    subjects: [] as string[],
    keywordComponents: [
      {
        subject,
        courseNumber: number,
        section: "",
        synonym: "",
      },
    ],
  };
}

function hasExactCode(summaries: CourseSummary[], code: string): boolean {
  return summaries.some((c) => c.code === code);
}

let providerSingleton: ColleagueSelfServiceProvider | null = null;

export function getCourseProvider(): CourseProvider {
  if (!providerSingleton) {
    providerSingleton = new ColleagueSelfServiceProvider();
  }
  return providerSingleton;
}
