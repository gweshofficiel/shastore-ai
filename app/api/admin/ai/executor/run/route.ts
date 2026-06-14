import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-access";
import { runOpenAIBackgroundExecutor } from "@/src/lib/ai/runtime/openai-background-executor";

export const dynamic = "force-dynamic";

function numericOption(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export async function POST(request: Request) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return NextResponse.json(
      { error: "Only Super Admin can run the OpenAI executor." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const summary = await runOpenAIBackgroundExecutor({
    maxJobs: numericOption(body.maxJobs),
    maxRuntimeMs: numericOption(body.maxRuntimeMs),
    requestedByUserId: access.user.id
  });

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
