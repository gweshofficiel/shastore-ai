import { NextRequest, NextResponse } from "next/server";
import { createTestEnvironmentImpersonationLink } from "@/lib/admin/test-environment-actions";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  const role = body?.role;

  if (!role) {
    return NextResponse.json({ error: "invalid-role", ok: false }, { status: 400 });
  }

  const result = await createTestEnvironmentImpersonationLink(role, request);

  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json(result);
}
