import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  assertFeatureAccess,
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { createStore } from "../../../../server/stores/create-store";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();

    const authResult = await supabase.auth.getUser(token);

    if (authResult.error || !authResult.data.user) {
      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const name = String(body?.name ?? "").trim();
    const slug = String(body?.slug ?? "").trim();
    const description = String(body?.description ?? "").trim();

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: "name and slug are required" },
        { status: 400 }
      );
    }

    const userSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    const access = await getUserSubscriptionAccessForClient(
      userSupabase,
      authResult.data.user.id
    );

    try {
      if (access.usage.storesUsed > 0) {
        assertFeatureAccess(access, "multi_store");
      }

      assertUsageWithinLimits(access, "stores");
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: billingEnforcementMessage(error) ?? "Plan limit reached",
        },
        { status: 403 }
      );
    }

    const store = await createStore({
      ownerUserId: authResult.data.user.id,
      name,
      slug,
      description,
    });

    return NextResponse.json({ success: true, store }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create store",
      },
      { status: 500 }
    );
  }
}