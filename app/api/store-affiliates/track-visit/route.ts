import { NextRequest, NextResponse } from "next/server";
import { recordAffiliateVisit } from "@/lib/store-affiliates";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let payload: Record<string, unknown> = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const storeId = cleanText(payload.storeId, 80);
  const affiliateCode = cleanText(payload.affiliateCode, 80);
  const landingPath = cleanText(payload.landingPath, 500);
  const visitorId = cleanText(payload.visitorId, 120);

  if (!storeId || !affiliateCode) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: store } = await admin
    .from("stores")
    .select("id, workspace_id")
    .eq("id", storeId)
    .maybeSingle();
  const storeRow = store as { id: string; workspace_id?: string | null } | null;

  if (!storeRow?.workspace_id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await recordAffiliateVisit(admin, {
    affiliateCode,
    landingPath,
    metadata: {
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null
    },
    storeId,
    visitorId,
    workspaceId: storeRow.workspace_id
  });

  return NextResponse.json({ ok: true });
}
