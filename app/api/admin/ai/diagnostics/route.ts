import { NextResponse } from "next/server";
import {
  getAIDiagnosticsSnapshot,
  runAIDiagnostic,
  runAllAIDiagnostics
} from "@/src/lib/ai/diagnostics/diagnostics-service";
import type { AIDiagnosticsProviderKey } from "@/src/lib/ai/diagnostics/diagnostics-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getAIDiagnosticsSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : "all";
  const result = provider === "all"
    ? await runAllAIDiagnostics({ audit: true })
    : await runAIDiagnostic(provider as AIDiagnosticsProviderKey, { audit: true });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
