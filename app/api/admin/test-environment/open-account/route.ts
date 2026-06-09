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
    if (result.error === "customer-store-link-missing") {
      return NextResponse.json(
        {
          ...result,
          message: "Customer test account is not linked to a store customer record"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json(result);
}
