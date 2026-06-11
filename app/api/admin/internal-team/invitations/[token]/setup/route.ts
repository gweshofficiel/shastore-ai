import { NextRequest, NextResponse } from "next/server";
import { processInternalTeamInviteSetup } from "@/lib/admin/internal-team-invite-setup";

type SetupRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, { params }: SetupRouteProps) {
  const { token } = await params;
  let password = "";
  let confirmPassword = "";

  try {
    const body = (await request.json()) as {
      confirmPassword?: string;
      password?: string;
    };
    password = String(body.password ?? "");
    confirmPassword = String(body.confirmPassword ?? "");
  } catch {
    const formData = await request.formData();
    password = String(formData.get("password") ?? "");
    confirmPassword = String(formData.get("confirmPassword") ?? "");
  }

  const result = await processInternalTeamInviteSetup({
    confirmPassword,
    password,
    token
  });

  if (!result.success) {
    return NextResponse.json(
      {
        code: result.code,
        message: result.message,
        success: false
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    email: result.email,
    message: "Internal team account setup completed.",
    redirectTo: result.redirectTo,
    success: true
  });
}
