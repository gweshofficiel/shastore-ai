import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  loadTestEnvironmentAccountForImpersonation,
  recordTestEnvironmentImpersonation,
  resolveOpenAccountPath
} from "@/lib/admin/test-environment-actions";
import { resolveAppOrigin } from "@/lib/deployment/app-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveWorkspaceCookie } from "@/lib/workspaces/active-workspace";
import type { Database } from "@/types/database";

function impersonationErrorResponse(error: string, status = 403) {
  const message = error === "customer-store-link-missing"
    ? "Customer test account is not linked to a store customer record"
    : undefined;

  return NextResponse.json({ error, message, ok: false }, { status });
}

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");

  if (!role) {
    return impersonationErrorResponse("invalid-role", 400);
  }

  const loaded = await loadTestEnvironmentAccountForImpersonation(role);

  if (!loaded.ok) {
    return impersonationErrorResponse(loaded.error);
  }

  const admin = createAdminClient();

  if (!admin) {
    return impersonationErrorResponse("impersonation-failed", 500);
  }

  const openPath = await resolveOpenAccountPath(loaded.definition.role, loaded.definition, loaded.registry.email);

  if (!openPath) {
    return impersonationErrorResponse("customer-store-link-missing", 409);
  }

  const { origin } = await resolveAppOrigin(request);
  const redirectTo = `${origin}${openPath}`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    email: loaded.authUser.email!,
    options: {
      redirectTo
    },
    type: "magiclink"
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return impersonationErrorResponse("impersonation-failed", 500);
  }

  const generatedForUserId = linkData.user?.id ?? loaded.authUser.id;

  console.info("[test-env][open-account] establish", {
    generatedForUserId,
    selectedAuthUserId: loaded.registry.auth_user_id,
    selectedEmail: loaded.registry.email,
    selectedRole: role
  });

  if (generatedForUserId !== loaded.registry.auth_user_id) {
    return impersonationErrorResponse("impersonation-failed", 500);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      }
    }
  );

  await supabase.auth.signOut();

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email"
  });

  if (verifyError || !verified.user) {
    return impersonationErrorResponse("impersonation-failed", 500);
  }

  if (verified.user.id !== loaded.registry.auth_user_id) {
    return impersonationErrorResponse("impersonation-failed", 500);
  }

  if (role === "owner") {
    await setActiveWorkspaceCookie(verified.user.id);
  }

  await recordTestEnvironmentImpersonation({
    accountId: loaded.registry.id || null,
    actorUserId: loaded.actorUserId,
    authUserId: loaded.registry.auth_user_id,
    metadata: {
      email: loaded.registry.email,
      redirect_to: redirectTo,
      role
    }
  });

  return NextResponse.redirect(new URL(openPath, origin));
}
