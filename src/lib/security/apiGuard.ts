import { NextResponse } from "next/server";
import {
  clientKeyFromRequest,
  rateLimit,
} from "@/lib/security/rateLimit";

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000,
): NextResponse | null {
  const key = `${scope}:${clientKeyFromRequest(request)}`;
  const result = rateLimit({ key, limit, windowMs });
  if (result.ok) return null;

  return NextResponse.json(
    {
      error: "Too many requests. Wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}

export function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
