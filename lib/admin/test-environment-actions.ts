"use server";

import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess, isPlatformAdminEmail } from "@/lib/admin-access";
import { resolveAppOrigin } from "@/lib/deployment/app-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type TestRole = "admin" | "customer" | "delivery" | "owner" | "reseller";

type TestAccountDefinition = {
  accountType: "admin" | "delivery" | "reseller" | "user";
  dashboardPath: string;
  displayName: string;
  email: string;
  role: TestRole;
};

const testAccountDefinitions: TestAccountDefinition[] = [
  {
    accountType: "admin",
    dashboardPath: "/admin",
    displayName: "Super Admin Test",
    email: process.env.SHASTORE_TEST_ADMIN_EMAIL ?? "superadmin.test@shastore.test",
    role: "admin"
  },
  {
    accountType: "user",
    dashboardPath: "/dashboard",
    displayName: "Store Owner Test",
    email: process.env.SHASTORE_TEST_OWNER_EMAIL ?? "owner.test@shastore.test",
    role: "owner"
  },
  {
    accountType: "reseller",
    dashboardPath: "/reseller/dashboard",
    displayName: "Reseller Test",
    email: process.env.SHASTORE_TEST_RESELLER_EMAIL ?? "reseller.test@shastore.test",
    role: "reseller"
  },
  {
    accountType: "user",
    dashboardPath: "/dashboard",
    displayName: "Customer Test",
    email: process.env.SHASTORE_TEST_CUSTOMER_EMAIL ?? "customer.test@shastore.test",
    role: "customer"
  },
  {
    accountType: "delivery",
    dashboardPath: "/delivery/dashboard",
    displayName: "Delivery Test",
    email: process.env.SHASTORE_TEST_DELIVERY_EMAIL ?? "delivery.test@shastore.test",
    role: "delivery"
  }
];

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function generatedPassword() {
  return `ShaTest-${randomBytes(18).toString("base64url")}!9`;
}

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function accountIdForRole(role: TestRole) {
  const suffixes: Record<TestRole, string> = {
    admin: "A",
    customer: "U",
    delivery: "D",
    owner: "O",
    reseller: "R"
  };

  return `SHATEST${suffixes[role]}`;
}

function auditMetadata(value: Record<string, unknown> = {}) {
  return {
    source: "admin_test_environment",
    ...value
  };
}

function testAccountMetadata(definition: TestAccountDefinition) {
  const baseMetadata = {
    account_type: definition.accountType,
    full_name: definition.displayName,
    role: definition.role,
    shastore_test_account: true,
    shastore_test_role: definition.role
  };

  if (definition.role === "delivery") {
    return {
      ...baseMetadata,
      account_role: "delivery",
      account_type: "delivery",
      delivery_role: "delivery"
    };
  }

  return baseMetadata;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();
  const adminAccess = isPlatformAdminEmail(access.user.email);

  if (!adminAccess.isAdmin) {
    redirect("/admin/test-environment?test_accounts=super-admin-required");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase service role client is not configured.");
  }

  return {
    actorUserId: access.user.id,
    admin
  };
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  return data.users.find((user) => normalizedEmail(user.email ?? "") === normalizedEmail(email)) ?? null;
}

async function writeAuditLog(input: {
  accountId?: string | null;
  actorUserId?: string | null;
  authUserId?: string | null;
  eventType: "account_creation" | "deactivation" | "impersonation" | "login" | "logout" | "password_reset" | "status_refresh";
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("test_environment_audit_logs" as never).insert({
    account_id: input.accountId ?? null,
    actor_user_id: input.actorUserId ?? null,
    auth_user_id: input.authUserId ?? null,
    event_type: input.eventType,
    metadata: auditMetadata(input.metadata),
    created_at: new Date().toISOString()
  } as never);
}

async function upsertAccountProfile(definition: TestAccountDefinition, authUserId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("account_profiles" as never).upsert({
    account_id: accountIdForRole(definition.role),
    account_type: definition.accountType,
    display_name: definition.displayName,
    email: definition.email,
    user_id: authUserId,
    updated_at: new Date().toISOString()
  } as never, { onConflict: "user_id,account_type" } as never);

  if (error) {
    console.warn("[test-environment] account profile repair skipped", {
      email: definition.email,
      message: error.message,
      role: definition.role
    });
  }
}

async function upsertTestAccountRegistry(input: {
  actorUserId: string;
  authUserId: string;
  definition: TestAccountDefinition;
  passwordHash?: string | null;
  verified: boolean;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("test_environment_accounts" as never)
    .upsert({
      auth_user_id: input.authUserId,
      email: normalizedEmail(input.definition.email),
      password_hash: input.passwordHash ?? undefined,
      role: input.definition.role,
      status: "active",
      updated_at: now,
      verified: input.verified
    } as never, { onConflict: "role" } as never)
    .select("id")
    .single();

  if (error) {
    console.warn("[test-environment] registry upsert skipped", {
      email: input.definition.email,
      message: error.message,
      role: input.definition.role
    });
    return null;
  }

  const row = data as { id?: string } | null;
  await writeAuditLog({
    accountId: row?.id ?? null,
    actorUserId: input.actorUserId,
    authUserId: input.authUserId,
    eventType: "account_creation",
    metadata: {
      email: input.definition.email,
      role: input.definition.role
    }
  });

  return row?.id ?? null;
}

export async function createTestEnvironmentAccounts() {
  const { actorUserId, admin } = await requireSuperAdmin();

  for (const definition of testAccountDefinitions) {
    const password = generatedPassword();
    const email = normalizedEmail(definition.email);
    const existingUser = await findAuthUserByEmail(email);
    const metadata = testAccountMetadata(definition);

    const authResult = existingUser
      ? await admin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: metadata,
          email_confirm: true,
          password,
          user_metadata: metadata
        })
      : await admin.auth.admin.createUser({
          app_metadata: metadata,
          email,
          email_confirm: true,
          password,
          user_metadata: metadata
        });

    if (authResult.error || !authResult.data.user) {
      await writeAuditLog({
        actorUserId,
        eventType: "account_creation",
        metadata: {
          email,
          error: authResult.error?.message ?? "Unknown auth user creation error.",
          role: definition.role
        }
      });
      continue;
    }

    await upsertAccountProfile(definition, authResult.data.user.id);
    await upsertTestAccountRegistry({
      actorUserId,
      authUserId: authResult.data.user.id,
      definition: {
        ...definition,
        email
      },
      passwordHash: hashPassword(password),
      verified: true
    });
  }

  revalidatePath("/admin/test-environment");
  redirect("/admin/test-environment?test_accounts=created");
}

export async function resetTestEnvironmentPasswords() {
  const { actorUserId, admin } = await requireSuperAdmin();

  for (const definition of testAccountDefinitions) {
    const user = await findAuthUserByEmail(definition.email);

    if (!user) {
      continue;
    }

    const password = generatedPassword();
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password
    });
    const accountId = await upsertTestAccountRegistry({
      actorUserId,
      authUserId: user.id,
      definition,
      passwordHash: hashPassword(password),
      verified: !error
    });

    await writeAuditLog({
      accountId,
      actorUserId,
      authUserId: user.id,
      eventType: "password_reset",
      metadata: {
        email: definition.email,
        error: error?.message ?? null,
        role: definition.role
      }
    });
  }

  revalidatePath("/admin/test-environment");
  redirect("/admin/test-environment?test_accounts=passwords-reset");
}

export async function refreshTestEnvironmentAccountStatus() {
  const { actorUserId } = await requireSuperAdmin();

  for (const definition of testAccountDefinitions) {
    const user = await findAuthUserByEmail(definition.email);

    if (!user) {
      continue;
    }

    const accountId = await upsertTestAccountRegistry({
      actorUserId,
      authUserId: user.id,
      definition,
      verified: Boolean(user.email_confirmed_at ?? user.confirmed_at)
    });

    await writeAuditLog({
      accountId,
      actorUserId,
      authUserId: user.id,
      eventType: "status_refresh",
      metadata: {
        email: definition.email,
        role: definition.role
      }
    });
  }

  revalidatePath("/admin/test-environment");
  redirect("/admin/test-environment?test_accounts=refreshed");
}

export async function deactivateTestEnvironmentAccount(formData: FormData) {
  const { actorUserId, admin } = await requireSuperAdmin();
  const role = String(formData.get("role") ?? "") as TestRole;
  const definition = testAccountDefinitions.find((candidate) => candidate.role === role);

  if (!definition) {
    redirect("/admin/test-environment?test_accounts=invalid-role");
  }

  const user = await findAuthUserByEmail(definition.email);

  if (user) {
    await admin.auth.admin.updateUserById(user.id, {
      ban_duration: "876000h"
    });
  }

  const { data } = await admin
    .from("test_environment_accounts" as never)
    .update({
      status: "inactive",
      updated_at: new Date().toISOString()
    } as never)
    .eq("role" as never, role as never)
    .select("id, auth_user_id")
    .maybeSingle();
  const row = data as { auth_user_id?: string | null; id?: string | null } | null;

  await writeAuditLog({
    accountId: row?.id ?? null,
    actorUserId,
    authUserId: row?.auth_user_id ?? user?.id ?? null,
    eventType: "deactivation",
    metadata: {
      email: definition.email,
      role
    }
  });

  revalidatePath("/admin/test-environment");
  redirect("/admin/test-environment?test_accounts=deactivated");
}

type TestEnvironmentImpersonationError =
  | "customer-store-link-missing"
  | "inactive"
  | "impersonation-failed"
  | "invalid-role"
  | "missing-auth-user"
  | "super-admin-required";

type TestEnvironmentImpersonationResult =
  | { error: TestEnvironmentImpersonationError; ok: false }
  | { ok: true; url: string };

type TestEnvironmentRegistryAccount = {
  auth_user_id: string;
  email: string;
  id: string;
  status: string;
};

type LoadedTestEnvironmentAccount = {
  actorUserId: string;
  authUser: {
    email: string | null;
    id: string;
  };
  definition: TestAccountDefinition;
  registry: TestEnvironmentRegistryAccount;
};

async function requireSuperAdminForImpersonation() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const adminAccess = isPlatformAdminEmail(user?.email);

  if (!user || !adminAccess.isAdmin) {
    return { error: "super-admin-required" as const, ok: false as const };
  }

  return {
    actorUserId: user.id,
    ok: true as const
  };
}

export async function loadTestEnvironmentAccountForImpersonation(
  roleInput: string
): Promise<
  | { error: TestEnvironmentImpersonationError; ok: false }
  | ({ ok: true } & LoadedTestEnvironmentAccount)
> {
  const role = roleInput as TestRole;
  const access = await requireSuperAdminForImpersonation();

  if (!access.ok) {
    return { error: access.error, ok: false };
  }

  const admin = createAdminClient();

  if (!admin) {
    return { error: "impersonation-failed", ok: false };
  }

  const definition = testAccountDefinitions.find((candidate) => candidate.role === role);

  if (!definition) {
    return { error: "invalid-role", ok: false };
  }

  const { data: registry } = await admin
    .from("test_environment_accounts" as never)
    .select("id, email, auth_user_id, status")
    .eq("role" as never, role as never)
    .maybeSingle();
  const account = registry as {
    auth_user_id?: string | null;
    email?: string | null;
    id?: string | null;
    status?: string | null;
  } | null;

  if (!account?.auth_user_id || !account.email) {
    return { error: "missing-auth-user", ok: false };
  }

  if (account.status === "inactive") {
    return { error: "inactive", ok: false };
  }

  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(account.auth_user_id);

  if (authError || !authResult.user) {
    return { error: "missing-auth-user", ok: false };
  }

  const registryEmail = normalizedEmail(account.email);
  const definitionEmail = normalizedEmail(definition.email);
  const authEmail = normalizedEmail(authResult.user.email ?? "");

  if (!authEmail || authEmail !== registryEmail || authEmail !== definitionEmail) {
    return { error: "impersonation-failed", ok: false };
  }

  return {
    actorUserId: access.actorUserId,
    authUser: {
      email: authResult.user.email ?? account.email,
      id: authResult.user.id
    },
    definition,
    ok: true,
    registry: {
      auth_user_id: account.auth_user_id,
      email: account.email,
      id: account.id ?? "",
      status: account.status ?? "active"
    }
  };
}

const TEST_CUSTOMER_PORTAL_PHONE = "+15551234567";

function portalPhoneFromCustomerRow(phone: string | null | undefined) {
  const trimmed = phone?.trim();
  return trimmed || TEST_CUSTOMER_PORTAL_PHONE;
}

type CustomerStoreLinkRow = {
  phone?: string | null;
  store_id?: string | null;
};

function firstCustomerStoreLink(data: unknown) {
  return ((data ?? []) as CustomerStoreLinkRow[])[0] ?? null;
}

async function linkedCustomerStorePath(email: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const selectedEmail = normalizedEmail(email);
  const { data: storeCustomerRows } = await admin
    .from("store_customers" as never)
    .select("store_id, phone, email, normalized_email")
    .eq("normalized_email" as never, selectedEmail as never)
    .limit(1);
  let storeCustomer = firstCustomerStoreLink(storeCustomerRows);

  if (!storeCustomer) {
    const { data: storeCustomerEmailRows } = await admin
      .from("store_customers" as never)
      .select("store_id, phone, email, normalized_email")
      .eq("email" as never, selectedEmail as never)
      .limit(1);
    storeCustomer = firstCustomerStoreLink(storeCustomerEmailRows);
  }

  const { data: customerRows } = storeCustomer
    ? { data: [] }
    : await admin
        .from("customers" as never)
        .select("store_id, phone, email, normalized_email")
        .eq("normalized_email" as never, selectedEmail as never)
        .limit(1);
  let customer = firstCustomerStoreLink(customerRows);

  if (!storeCustomer && !customer) {
    const { data: customerEmailRows } = await admin
      .from("customers" as never)
      .select("store_id, phone, email, normalized_email")
      .eq("email" as never, selectedEmail as never)
      .limit(1);
    customer = firstCustomerStoreLink(customerEmailRows);
  }

  const linkedCustomer = storeCustomer ?? customer;

  if (!linkedCustomer?.store_id) {
    return null;
  }

  const { data: storeData } = await admin
    .from("stores" as never)
    .select("id, slug, status")
    .eq("id" as never, linkedCustomer.store_id as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();
  const store = storeData as { id?: string | null; slug?: string | null; status?: string | null } | null;

  if (!store?.id || !store.slug) {
    return null;
  }

  const { data: publicationData } = await admin
    .from("published_stores" as never)
    .select("store_id, slug, status, visibility")
    .eq("store_id" as never, store.id as never)
    .eq("slug" as never, store.slug as never)
    .eq("status" as never, "published" as never)
    .eq("visibility" as never, "public" as never)
    .maybeSingle();
  const publication = publicationData as { slug?: string | null; status?: string | null; visibility?: string | null } | null;

  if (!publication?.slug) {
    return null;
  }

  return `/store/${publication.slug}/account?phone=${encodeURIComponent(portalPhoneFromCustomerRow(linkedCustomer.phone))}`;
}

export async function resolveOpenAccountPath(role: TestRole, definition: TestAccountDefinition, selectedEmail = definition.email) {
  if (role !== "customer") {
    return definition.dashboardPath;
  }

  return linkedCustomerStorePath(selectedEmail);
}

export async function createTestEnvironmentImpersonationLink(
  roleInput: string,
  request?: NextRequest
): Promise<TestEnvironmentImpersonationResult> {
  const role = roleInput as TestRole;
  const loaded = await loadTestEnvironmentAccountForImpersonation(role);

  if (!loaded.ok) {
    return loaded;
  }

  const { origin } = await resolveAppOrigin(request);
  const openPath = await resolveOpenAccountPath(role, loaded.definition, loaded.registry.email);

  if (!openPath) {
    return { error: "customer-store-link-missing", ok: false };
  }

  console.info("[test-env][open-account] prepare", {
    generatedForUserId: loaded.authUser.id,
    selectedAuthUserId: loaded.registry.auth_user_id,
    selectedEmail: loaded.registry.email,
    selectedRole: role
  });

  return {
    ok: true,
    url: `${origin}/api/admin/test-environment/establish-session?role=${encodeURIComponent(role)}`
  };
}

export async function openTestEnvironmentAccount(
  role: TestRole
): Promise<TestEnvironmentImpersonationResult> {
  return createTestEnvironmentImpersonationLink(role);
}

export async function recordTestEnvironmentImpersonation(input: {
  accountId: string | null;
  actorUserId: string;
  authUserId: string;
  metadata?: Record<string, unknown>;
}) {
  await writeAuditLog({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    authUserId: input.authUserId,
    eventType: "impersonation",
    metadata: auditMetadata(input.metadata)
  });
}

export async function impersonateTestEnvironmentAccount(formData: FormData) {
  const role = String(formData.get("role") ?? "") as TestRole;
  const result = await createTestEnvironmentImpersonationLink(role);

  if (!result.ok) {
    redirect(`/admin/test-environment?test_accounts=${result.error}`);
  }

  redirect(result.url);
}

export async function recordTestEnvironmentLogin(input: {
  email: string;
  route: string;
  userId: string | null;
}) {
  const admin = createAdminClient();

  if (!admin || !input.userId) {
    return;
  }

  const { data } = await admin
    .from("test_environment_accounts" as never)
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as never)
    .eq("auth_user_id" as never, input.userId as never)
    .select("id")
    .maybeSingle();
  const row = data as { id?: string | null } | null;

  if (!row?.id) {
    return;
  }

  await writeAuditLog({
    accountId: row.id,
    authUserId: input.userId,
    eventType: "login",
    metadata: {
      email: input.email,
      route: input.route
    }
  });
}

export async function recordTestEnvironmentLogout(userId: string | null | undefined) {
  const admin = createAdminClient();

  if (!admin || !userId) {
    return;
  }

  const { data } = await admin
    .from("test_environment_accounts" as never)
    .select("id")
    .eq("auth_user_id" as never, userId as never)
    .maybeSingle();
  const row = data as { id?: string | null } | null;

  if (!row?.id) {
    return;
  }

  await writeAuditLog({
    accountId: row.id,
    authUserId: userId,
    eventType: "logout"
  });
}
