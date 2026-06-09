import { getAdminAccess } from "@/lib/admin-access";
import { getAdminResellers, getAdminStores, getAdminUsers } from "@/lib/admin/data";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistryStatus = "available" | "missing";

export type TestEnvironmentAccount = {
  email: string;
  id: string;
  label: string;
  status: RegistryStatus;
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
  id: string;
  name?: string | null;
  status?: string | null;
};

type DeliveryAssignmentRow = {
  delivery_agent_id?: string | null;
  status?: string | null;
};

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

function missingAccount(label: string): TestEnvironmentAccount {
  return {
    email: "Not found",
    id: "Not found",
    label,
    status: "missing"
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

export async function getTestEnvironmentData(): Promise<TestEnvironmentData> {
  await getAdminAccess();

  const [users, stores, resellers, accountProfiles] = await Promise.all([
    getAdminUsers(),
    getAdminStores(),
    getAdminResellers(),
    safeSelect<AccountProfileRow>("account_profiles", "user_id, account_type, display_name", 500)
  ]);
  const profileByUser = new Map(accountProfiles.map((profile) => [text(profile.user_id), profile]));
  const accountFor = (label: string, type: string) => {
    const profileMatch = accountProfiles.find((profile) =>
      text(profile.account_type) === type && looksLikeTest(profile.display_name)
    );
    const user = users.find((candidate) => {
      const profile = profileByUser.get(candidate.id);
      return (
        profile?.account_type === type ||
        looksLikeTest(candidate.email, candidate.fullName, profile?.display_name)
      ) && looksLikeTest(candidate.email, candidate.fullName, profile?.display_name, type === "admin" ? "admin" : null);
    }) ?? users.find((candidate) => text(profileMatch?.user_id) === candidate.id);

    return user
      ? {
          email: user.email,
          id: user.id,
          label,
          status: "available" as const
        }
      : missingAccount(label);
  };
  const accounts = [
    accountFor("Admin Test Account", "admin"),
    accountFor("Owner Test Account", "owner"),
    accountFor("Reseller Test Account", "reseller"),
    accountFor("Customer Test Account", "customer"),
    accountFor("Delivery Test Account", "delivery")
  ];
  const testStore = stores.find((store) => looksLikeTest(store.name, store.slug, store.ownerEmail)) ?? null;
  const ownerAccount = accounts.find((account) => account.label === "Owner Test Account");
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
        customer: accounts.find((account) => account.label === "Customer Test Account")?.email ?? "Not found",
        id: "Not found",
        owner: orderOwner,
        registryStatus: "missing" as const,
        status: "Missing"
      };
  const [deliveryAgents, assignments] = await Promise.all([
    safeSelect<DeliveryAgentRow>("store_delivery_agents", "id, name, status, availability_status", 100),
    safeSelect<DeliveryAssignmentRow>("delivery_assignments", "delivery_agent_id, status", 100)
  ]);
  const deliveryAgent =
    deliveryAgents.find((agent) => looksLikeTest(agent.name, agent.status, agent.availability_status)) ??
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
  const testReseller =
    resellers.find((reseller) => looksLikeTest(reseller.email, reseller.fullName, reseller.profile.displayName, reseller.profile.slug)) ??
    null;
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
    { label: "Delivery exists", ok: accounts[4].status === "available" },
    { label: "Store exists", ok: store.registryStatus === "available" },
    { label: "Product exists", ok: product.registryStatus === "available" }
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
