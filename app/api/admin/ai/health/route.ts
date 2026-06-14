import { NextResponse } from "next/server";
import { getAIProviderHealthSnapshot } from "@/src/lib/ai/health/health-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getAIProviderHealthSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
