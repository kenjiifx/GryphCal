import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, jsonError } from "@/lib/security/apiGuard";
import { getCourseProvider } from "@/lib/guelph/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "search", 60);
  if (limited) return limited;

  const term = request.nextUrl.searchParams.get("term")?.trim() ?? "";
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!term || term.length > 16) {
    return jsonError("Valid 'term' query parameter is required.", 400);
  }
  if (!q || q.length > 120) {
    return jsonError("Valid 'q' query parameter is required.", 400);
  }
  if (q.length < 2) {
    return NextResponse.json({ courses: [] });
  }

  try {
    // Pass raw query — provider classifies code vs subject vs title
    const courses = await getCourseProvider().searchCourses(term, q);
    return NextResponse.json(
      { courses: courses.slice(0, 80) },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    console.error("[api/courses/search]", error);
    return jsonError(
      error instanceof Error ? error.message : "Course search failed.",
      502,
    );
  }
}
