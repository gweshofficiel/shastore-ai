import { NextRequest, NextResponse } from "next/server";
import { processDueCustomerLifecycleEvents } from "@/lib/customer-lifecycle-emails";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { processPendingStoreEmailQueue } from "@/lib/store-email-delivery";

export const dynamic = "force-dynamic";

function configuredQueueSecret() {
  return process.env.EMAIL_QUEUE_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
}

function authorized(request: NextRequest) {
  const secret = configuredQueueSecret();

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit({
    action: "email.process_pending",
    identifier:
      request.headers.get("authorization")?.slice(0, 32) ||
      request.headers.get("x-forwarded-for") ||
      "email-process",
    limit: 20,
    route: "/api/store-email/process",
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    storeId?: string | null;
    workspaceId?: string | null;
  };
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const lifecycleResult = await processDueCustomerLifecycleEvents({
    limit: typeof body.limit === "number" ? body.limit : 10,
    storeId: typeof body.storeId === "string" ? body.storeId : null,
    workspaceId
  });
  const result = await processPendingStoreEmailQueue({
    limit: typeof body.limit === "number" ? body.limit : 10,
    storeId: typeof body.storeId === "string" ? body.storeId : null,
    workspaceId
  });

  return NextResponse.json({ lifecycle: lifecycleResult, ok: true, ...result });
}
