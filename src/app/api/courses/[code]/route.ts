import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, jsonError } from "@/lib/security/apiGuard";
import { getCourseProvider } from "@/lib/guelph/provider";
import { normalizeCourseCode } from "@/lib/utils/courseCode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const limited = enforceRateLimit(request, "sections", 40);
  if (limited) return limited;

  const { code: rawCode } = await context.params;
  const term = request.nextUrl.searchParams.get("term")?.trim() ?? "";
  const code = normalizeCourseCode(decodeURIComponent(rawCode));

  if (!term || term.length > 16 || !code || code.length > 32) {
    return jsonError("Term and course code are required.", 400);
  }

  try {
    const course = await getCourseProvider().getCourseSections(term, code);
    return NextResponse.json(
      { course },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("[api/courses/[code]]", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to load course sections.",
      502,
    );
  }
}
