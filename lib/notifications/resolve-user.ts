import { createAdminClient } from "@/lib/supabase/admin";

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function notificationTestFallbackEnabled() {
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }

  if (process.env.BILLING_NOTIFICATION_TEST_FALLBACK === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}

async function findAuthUserIdByEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    console.log("[stripe-debug] user lookup skipped (no customer email)");
    return null;
  }

  const supabase = createAdminClient();

  if (!supabase) {
    console.warn("[stripe-debug] user lookup failed (missing service role client)", {
      customerEmail: normalizedEmail
    });
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles" as never)
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    console.warn("[billing-notification-skip] profile email lookup failed", {
      customerEmail: normalizedEmail,
      message: profileError.message
    });
  }

  const profileUserId = (profile as { id?: string | null } | null)?.id ?? null;

  if (profileUserId) {
    return profileUserId;
  }

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[billing-notification-skip] auth email lookup failed", {
      customerEmail: normalizedEmail,
      message: error.message
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id ?? null;
}

async function findTestModeFallbackUserId() {
  if (!notificationTestFallbackEnabled()) {
    return null;
  }

  for (const email of configuredAdminEmails()) {
    const userId = await findAuthUserIdByEmail(email);

    if (userId) {
      console.warn("[billing-notification] test fallback resolved configured admin user", {
        resolvedUserId: userId
      });
      return userId;
    }
  }

  const supabase = createAdminClient();

  if (!supabase) {
    console.warn("[billing-notification-skip] test fallback skipped without service client");
    return null;
  }

  const { data: adminProfiles, error: profileError } = await supabase
    .from("account_profiles" as never)
    .select("user_id")
    .eq("account_type", "admin")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!profileError) {
    const profileUserId =
      ((adminProfiles ?? [])[0] as { user_id?: string | null } | undefined)?.user_id ?? null;

    if (profileUserId) {
      console.warn("[billing-notification] test fallback resolved admin account profile", {
        resolvedUserId: profileUserId
      });
      return profileUserId;
    }
  } else {
    console.warn("[billing-notification-skip] test fallback admin profile lookup failed", {
      message: profileError.message
    });
  }

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (error) {
    console.warn("[billing-notification-skip] test fallback auth user lookup failed", {
      message: error.message
    });
    return null;
  }

  const fallbackUserId = data.users[0]?.id ?? null;

  if (fallbackUserId) {
    console.warn("[billing-notification] test fallback resolved first auth user", {
      resolvedUserId: fallbackUserId
    });
  }

  return fallbackUserId;
}

export async function resolveNotificationUserId({
  currentUserId,
  eventType,
  stripeCustomerEmail
}: {
  currentUserId?: string | null;
  eventType: string;
  stripeCustomerEmail?: string | null;
}) {
  try {
    if (currentUserId) {
      console.log("[stripe-debug] user resolved from billing record", {
        customerEmail: stripeCustomerEmail ?? null,
        eventType,
        resolvedUserId: currentUserId
      });
      return currentUserId;
    }

    const emailUserId = await findAuthUserIdByEmail(stripeCustomerEmail);

    if (emailUserId) {
      console.log("[stripe-debug] user resolved from Stripe customer email", {
        customerEmail: stripeCustomerEmail ?? null,
        eventType,
        resolvedUserId: emailUserId
      });
      return emailUserId;
    }

    console.log("[stripe-debug] user not found by email", {
      customerEmail: stripeCustomerEmail ?? null,
      eventType,
      testFallbackAllowed: notificationTestFallbackEnabled()
    });

    const fallbackUserId = await findTestModeFallbackUserId();

    if (fallbackUserId) {
      console.log("[stripe-debug] user resolved from test fallback", {
        customerEmail: stripeCustomerEmail ?? null,
        eventType,
        resolvedUserId: fallbackUserId
      });
      return fallbackUserId;
    }

    console.warn("[stripe-debug] user resolution failed", {
      customerEmail: stripeCustomerEmail ?? null,
      eventType,
      failureReason: "no_billing_user_no_email_match_no_test_fallback",
      testFallbackAllowed: notificationTestFallbackEnabled()
    });
  } catch (error) {
    console.warn("[stripe-debug] user resolution error", {
      customerEmail: stripeCustomerEmail ?? null,
      eventType,
      failureReason: "resolution_exception",
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return null;
}
