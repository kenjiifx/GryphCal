import { NextResponse } from "next/server";
import { enforceRateLimit, jsonError } from "@/lib/security/apiGuard";
import { getCourseProvider } from "@/lib/guelph/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "terms", 30);
  if (limited) return limited;

  try {
    const terms = await getCourseProvider().getTerms();
    return NextResponse.json(
      { terms },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("[api/terms]", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to load terms from University of Guelph.",
      502,
    );
  }
}
