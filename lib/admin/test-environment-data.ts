import { getAdminAccess } from "@/lib/admin-access";
import { getAdminResellers, getAdminStores, getAdminUsers } from "@/lib/admin/data";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistryStatus = "available" | "missing";

export type TestEnvironmentAccount = {
  accountStatus: string;
  createdAt: string | null;
  email: string;
  id: string;
  label: string;
  lastLoginAt: string | null;
  linkedAsset: {
    href: string;
    label: string;
    status: RegistryStatus;
  };
  role: "Customer" | "Delivery" | "Reseller" | "Store Owner" | "Super Admin";
  status: RegistryStatus;
  verified: boolean;
};

export type TestEnvironmentData = {
  accounts: TestEnvironmentAccount[];
  delivery: {
    agent: string;
    currentStatus: string;
    id: string;
    status: RegistryStatus;
  };
  health: Array<{
    label: string;
    ok: boolean;
  }>;
  order: {
    customer: string;
    id: string;
    owner: string;
    status: string;
    registryStatus: RegistryStatus;
  };
  product: {
    id: string;
    inventory: string;
    name: string;
    price: string;
    registryStatus: RegistryStatus;
    sku: string;
  };
  reseller: {
    marketplaceListing: string;
    name: string;
    registryStatus: RegistryStatus;
    template: string;
  };
  store: {
    id: string;
    name: string;
    owner: string;
    registryStatus: RegistryStatus;
    status: string;
  };
};

type AccountProfileRow = {
  account_type?: string | null;
  display_name?: string | null;
  user_id?: string | null;
};

type ProductRow = {
  currency?: string | null;
  id: string;
  name?: string | null;
  price?: number | string | null;
  stock_quantity?: number | string | null;
  title?: string | null;
};

type ProductVariantRow = {
  product_id?: string | null;
  sku?: string | null;
};

type OrderRow = {
  customer_email?: string | null;
  customer_name?: string | null;
  id: string;
  order_status?: string | null;
  owner_user_id?: string | null;
  store_id?: string | null;
};

type DeliveryAgentRow = {
  availability_status?: string | null;
  email?: string | null;
  id: string;
  name?: string | null;
  status?: string | null;
  store_id?: string | null;
};

type DeliveryAssignmentRow = {
  delivery_agent_id?: string | null;
  status?: string | null;
};

type AuthUserStatus = {
  confirmedAt: string | null;
};

const testAccountEmails = {
  admin: process.env.SHASTORE_TEST_ADMIN_EMAIL ?? "superadmin.test@shastore.test",
  customer: process.env.SHASTORE_TEST_CUSTOMER_EMAIL ?? "customer.test@shastore.test",
  delivery: process.env.SHASTORE_TEST_DELIVERY_EMAIL ?? "delivery.test@shastore.test",
  owner: process.env.SHASTORE_TEST_OWNER_EMAIL ?? "owner.test@shastore.test",
  reseller: process.env.SHASTORE_TEST_RESELLER_EMAIL ?? "reseller.test@shastore.test"
} as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function looksLikeTest(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    const normalized = value?.toLowerCase() ?? "";
    return normalized.includes("test") || normalized.includes("demo") || normalized.includes("sandbox");
  });
}

function missingAccount(
  label: string,
  role: TestEnvironmentAccount["role"],
  expectedEmail: string,
  linkedAsset: TestEnvironmentAccount["linkedAsset"]
): TestEnvironmentAccount {
  return {
    accountStatus: "missing",
    createdAt: null,
    email: expectedEmail,
    id: "Not found",
    label,
    lastLoginAt: null,
    linkedAsset,
    role,
    status: "missing",
    verified: false
  };
}

async function safeSelect<T>(table: string, select: string, limit = 50): Promise<T[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await admin.from(table as never).select(select).limit(limit);

  if (error) {
    console.warn("[test-environment] registry lookup skipped", {
      message: error.message,
      table
    });
    return [];
  }

  return (data ?? []) as unknown as T[];
}

async function getAuthUserStatusMap() {
  const admin = createAdminClient();

  if (!admin) {
    return new Map<string, AuthUserStatus>();
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[test-environment] auth status lookup skipped", {
      message: error.message
    });
    return new Map<string, AuthUserStatus>();
  }

  return new Map(
    (data.users ?? []).map((user) => [
      user.id,
      {
        confirmedAt: user.email_confirmed_at ?? user.confirmed_at ?? null
      }
    ])
  );
}

export async function getTestEnvironmentData(): Promise<TestEnvironmentData> {
  await getAdminAccess();

  const [users, stores, resellers, accountProfiles, authStatus] = await Promise.all([
    getAdminUsers(),
    getAdminStores(),
    getAdminResellers(),
    safeSelect<AccountProfileRow>("account_profiles", "user_id, account_type, display_name", 500),
    getAuthUserStatusMap()
  ]);
  const profileByUser = new Map(accountProfiles.map((profile) => [text(profile.user_id), profile]));
  const testStore = stores.find((store) => looksLikeTest(store.name, store.slug, store.ownerEmail)) ?? null;
  const linkedStore = {
    href: testStore ? `/admin/stores?owner=${encodeURIComponent(testStore.ownerEmail)}` : "#store-registry",
    label: testStore?.name ?? "Test Store",
    status: testStore ? "available" as const : "missing" as const
  };
  const testReseller =
    resellers.find((reseller) => looksLikeTest(reseller.email, reseller.fullName, reseller.profile.displayName, reseller.profile.slug)) ??
    null;
  const linkedTemplate = {
    href: "#reseller-registry",
    label: testReseller?.ownedStores[0]?.name ?? "Test Template",
    status: testReseller ? "available" as const : "missing" as const
  };
  const accountFor = (
    label: string,
    role: TestEnvironmentAccount["role"],
    type: string,
    expectedEmail: string,
    linkedAsset: TestEnvironmentAccount["linkedAsset"]
  ) => {
    const roleKeywordMap: Record<string, string[]> = {
      admin: ["admin", "super"],
      customer: ["customer", "buyer"],
      delivery: ["delivery", "agent", "courier"],
      owner: ["owner", "seller", "store"],
      reseller: ["reseller"]
    };
    const roleKeywords = roleKeywordMap[type] ?? [type];
    const profileMatch = accountProfiles.find((profile) =>
      text(profile.account_type) === type && looksLikeTest(profile.display_name)
    );
    const exactEmailMatch = users.find((candidate) => candidate.email.toLowerCase() === expectedEmail.toLowerCase());
    const user = exactEmailMatch ?? users.find((candidate) => {
      const profile = profileByUser.get(candidate.id);
      const searchText = [
        candidate.email,
        candidate.fullName,
        profile?.display_name,
        profile?.account_type
      ].map((value) => value?.toLowerCase() ?? "").join(" ");
      const accountTypeMatches =
        profile?.account_type === type ||
        (type === "admin" && (candidate.planId === "admin" || candidate.email.toLowerCase().includes("admin")));
      const roleMatches = roleKeywords.some((keyword) => searchText.includes(keyword));

      return looksLikeTest(candidate.email, candidate.fullName, profile?.display_name) && (accountTypeMatches || roleMatches);
    }) ?? users.find((candidate) => text(profileMatch?.user_id) === candidate.id);

    return user
      ? {
          accountStatus: user.accountStatus,
          createdAt: user.createdAt,
          email: user.email,
          id: user.id,
          label,
          lastLoginAt: user.lastLoginAt,
          linkedAsset,
          role,
          status: "available" as const,
          verified: Boolean(authStatus.get(user.id)?.confirmedAt)
        }
      : missingAccount(label, role, expectedEmail, linkedAsset);
  };
  const accounts = [
    accountFor("Super Admin Test", "Super Admin", "admin", testAccountEmails.admin, {
      href: "/admin",
      label: "SHASTORE Admin",
      status: "available"
    }),
    accountFor("Store Owner Test", "Store Owner", "owner", testAccountEmails.owner, linkedStore),
    accountFor("Reseller Test", "Reseller", "reseller", testAccountEmails.reseller, linkedTemplate),
    accountFor("Customer Test", "Customer", "customer", testAccountEmails.customer, linkedStore),
    accountFor("Delivery Test", "Delivery", "delivery", testAccountEmails.delivery, linkedStore)
  ];
  const ownerAccount = accounts.find((account) => account.label === "Store Owner Test");
  const store = testStore
    ? {
        id: testStore.id,
        name: testStore.name,
        owner: testStore.ownerEmail,
        registryStatus: "available" as const,
        status: testStore.status
      }
    : {
        id: "Not found",
        name: "Test Store",
        owner: ownerAccount?.email ?? "Not found",
        registryStatus: "missing" as const,
        status: "Missing"
      };
  const products = await safeSelect<ProductRow>(
    "store_products",
    "id, store_id, title, name, price, currency, stock_quantity",
    100
  );
  const testProduct = products.find((product) => looksLikeTest(product.title, product.name)) ?? products[0] ?? null;
  const variants = testProduct
    ? await safeSelect<ProductVariantRow>("product_variants", "product_id, sku", 100)
    : [];
  const variant = variants.find((candidate) => candidate.product_id === testProduct?.id) ?? null;
  const product = testProduct
    ? {
        id: testProduct.id,
        inventory: numericValue(testProduct.stock_quantity).toLocaleString(),
        name: text(testProduct.title, text(testProduct.name, "Test Product")),
        price: new Intl.NumberFormat("en", {
          currency: text(testProduct.currency, "USD"),
          style: "currency"
        }).format(numericValue(testProduct.price)),
        registryStatus: "available" as const,
        sku: text(variant?.sku, "SKU not set")
      }
    : {
        id: "Not found",
        inventory: "Missing",
        name: "Test Product",
        price: "Missing",
        registryStatus: "missing" as const,
        sku: "Missing"
      };
  const [storeOrders, draftOrders] = await Promise.all([
    safeSelect<OrderRow>("store_orders", "id, store_id, owner_user_id, customer_name, customer_email, order_status", 100),
    safeSelect<OrderRow>("orders", "id, store_id, owner_user_id, customer_name, customer_email, order_status", 100)
  ]);
  const allOrders = [...storeOrders, ...draftOrders];
  const testOrder = allOrders.find((candidate) =>
    looksLikeTest(candidate.customer_name, candidate.customer_email, candidate.order_status)
  ) ?? allOrders.find((candidate) => candidate.store_id === testStore?.id) ?? null;
  const orderOwner = users.find((user) => user.id === testOrder?.owner_user_id)?.email ?? store.owner;
  const order = testOrder
    ? {
        customer: text(testOrder.customer_email, text(testOrder.customer_name, "Test Customer")),
        id: testOrder.id,
        owner: orderOwner,
        registryStatus: "available" as const,
        status: text(testOrder.order_status, "pending")
      }
    : {
        customer: accounts.find((account) => account.label === "Customer Test")?.email ?? "Not found",
        id: "Not found",
        owner: orderOwner,
        registryStatus: "missing" as const,
        status: "Missing"
      };
  const [deliveryAgents, assignments] = await Promise.all([
    safeSelect<DeliveryAgentRow>("store_delivery_agents", "id, store_id, name, email, status, availability_status", 100),
    safeSelect<DeliveryAssignmentRow>("delivery_assignments", "delivery_agent_id, status", 100)
  ]);
  const deliveryAgent =
    deliveryAgents.find((agent) => agent.store_id === testStore?.id && looksLikeTest(agent.name, agent.email, agent.status)) ??
    deliveryAgents.find((agent) => looksLikeTest(agent.name, agent.email, agent.status, agent.availability_status)) ??
    deliveryAgents[0] ??
    null;
  const activeAssignment = assignments.find((assignment) => assignment.delivery_agent_id === deliveryAgent?.id);
  const delivery = deliveryAgent
    ? {
        agent: text(deliveryAgent.name, "Delivery agent"),
        currentStatus: text(activeAssignment?.status, text(deliveryAgent.availability_status, text(deliveryAgent.status, "active"))),
        id: deliveryAgent.id,
        status: "available" as const
      }
    : {
        agent: "Assigned Delivery Agent",
        currentStatus: "Missing",
        id: "Not found",
        status: "missing" as const
      };
  const reseller = testReseller
    ? {
        marketplaceListing: testReseller.ownedStores[0]?.name ?? "Marketplace listing placeholder",
        name: testReseller.profile.displayName ?? testReseller.email,
        registryStatus: "available" as const,
        template: "Test template placeholder"
      }
    : {
        marketplaceListing: "Test Marketplace Listing",
        name: "Test Reseller",
        registryStatus: "missing" as const,
        template: "Test Template"
      };
  const health = [
    { label: "Admin exists", ok: accounts[0].status === "available" },
    { label: "Owner exists", ok: accounts[1].status === "available" },
    { label: "Reseller exists", ok: accounts[2].status === "available" },
    { label: "Customer exists", ok: accounts[3].status === "available" },
    { label: "Delivery exists", ok: accounts[4].status === "available" }
  ];

  return {
    accounts,
    delivery,
    health,
    order,
    product,
    reseller,
    store
  };
}
