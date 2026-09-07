import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateIcs } from "@/lib/calendar/generate";
import { enforceRateLimit, jsonError } from "@/lib/security/apiGuard";
import { selectedSectionSchema } from "@/lib/utils/persist";
import type { SelectedSection } from "@/lib/guelph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  selected: z.array(selectedSectionSchema).min(1).max(20),
});

/** Optional server fallback. Prefer client-side ICS so schedules never leave the browser. */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "calendar", 20);
  if (limited) return limited;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 200_000) {
      return jsonError("Request body too large.", 413);
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return jsonError("Invalid calendar request body.", 400);
    }

    const selected = parsed.data.selected as SelectedSection[];
    const ics = generateIcs({ selected });
    const term = selected[0]?.term ?? "schedule";
    const filename = `gryphcal-${term.toLowerCase()}.ics`;

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/calendar]", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate calendar.",
      500,
    );
  }
}
