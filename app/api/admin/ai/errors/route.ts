import { NextResponse } from "next/server";
import { getAIErrorCenterSnapshot } from "@/src/lib/ai/errors/error-service";
import type {
  AIErrorGroup,
  AIErrorSeverity
} from "@/src/lib/ai/errors/error-types";

export const dynamic = "force-dynamic";

function firstParam(url: URL, key: string) {
  return url.searchParams.get(key) || "all";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshot = await getAIErrorCenterSnapshot({
    dateRange: firstParam(url, "dateRange") as "24h" | "7d" | "30d" | "all",
    errorGroup: firstParam(url, "errorGroup") as AIErrorGroup | "all",
    provider: firstParam(url, "provider"),
    severity: firstParam(url, "severity") as AIErrorSeverity | "all",
    storeId: firstParam(url, "storeId")
  });

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
