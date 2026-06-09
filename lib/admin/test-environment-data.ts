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
  adminMonitoring: Array<WorkflowStatusItem>;
  accounts: TestEnvironmentAccount[];
  customerFlow: Array<WorkflowStatusItem>;
  delivery: {
    agent: string;
    currentStatus: string;
    id: string;
    status: RegistryStatus;
  };
  deliveryFlow: Array<WorkflowStatusItem>;
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
  orderFlow: Array<WorkflowStatusItem>;
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
  resellerFlow: Array<WorkflowStatusItem>;
  shortcuts: Array<{
    href: string;
    label: string;
    note: string;
  }>;
  store: {
    id: string;
    name: string;
    owner: string;
    registryStatus: RegistryStatus;
    slug: string | null;
    status: string;
  };
  workflowHealth: Array<WorkflowStatusItem>;
  workflowMap: Array<WorkflowStatusItem>;
};

export type WorkflowStatusItem = {
  label: string;
  note: string;
  ok: boolean;
  status: string;
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
  store_id?: string | null;
  title?: string | null;
};

type ProductVariantRow = {
  product_id?: string | null;
  sku?: string | null;
};

type OrderRow = {
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  fulfillment_status?: string | null;
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
  id: string;
  order_id?: string | null;
  order_source?: string | null;
  status?: string | null;
  store_id?: string | null;
};

type DeliveryProofRow = {
  assignment_id?: string | null;
  id: string;
};

type DeliveryCodRow = {
  assignment_id?: string | null;
  id: string;
  status?: string | null;
};

type DeliveryReturnRow = {
  assignment_id?: string | null;
  id: string;
  status?: string | null;
};

type StoreCustomerRow = {
  email?: string | null;
  id: string;
  last_order_id?: string | null;
  phone?: string | null;
  store_id?: string | null;
};

type CustomerAddressRow = {
  customer_id?: string | null;
  id: string;
};

type StoreWishlistRow = {
  customer_id?: string | null;
  id: string;
  user_id?: string | null;
};

type StoreSupportTicketRow = {
  customer_email?: string | null;
  customer_id?: string | null;
  customer_phone?: string | null;
  id: string;
  store_id?: string | null;
};

type LegacyCustomerOrderLinkRow = {
  customer_id?: string | null;
  delivery_agent_id?: string | null;
  order_id?: string | null;
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

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "");
}

function workflowItem(label: string, ok: boolean, status: string, note: string): WorkflowStatusItem {
  return {
    label,
    note,
    ok,
    status
  };
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
        slug: testStore.slug,
        status: testStore.status
      }
    : {
        id: "Not found",
        name: "Test Store",
        owner: ownerAccount?.email ?? "Not found",
        registryStatus: "missing" as const,
        slug: null,
        status: "Missing"
      };
  const products = await safeSelect<ProductRow>(
    "store_products",
    "id, store_id, title, name, price, currency, stock_quantity",
    100
  );
  const testProduct =
    products.find((product) => product.store_id === testStore?.id && looksLikeTest(product.title, product.name)) ??
    products.find((product) => product.store_id === testStore?.id) ??
    products.find((product) => looksLikeTest(product.title, product.name)) ??
    products[0] ??
    null;
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
    safeSelect<OrderRow>("store_orders", "id, store_id, owner_user_id, customer_name, customer_email, customer_phone, order_status, fulfillment_status", 100),
    safeSelect<OrderRow>("orders", "id, store_id, owner_user_id, customer_name, customer_email, customer_phone, order_status, fulfillment_status", 100)
  ]);
  const allOrders = [...storeOrders, ...draftOrders];
  const customerAccount = accounts.find((account) => account.label === "Customer Test");
  const testOrder =
    allOrders.find(
      (candidate) =>
        candidate.store_id === testStore?.id &&
        customerAccount?.email !== "Not found" &&
        text(candidate.customer_email).toLowerCase() === customerAccount?.email.toLowerCase()
    ) ??
    allOrders.find((candidate) =>
      candidate.store_id === testStore?.id && looksLikeTest(candidate.customer_name, candidate.customer_email, candidate.order_status)
    ) ??
    allOrders.find((candidate) => candidate.store_id === testStore?.id) ??
    null;
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
    safeSelect<DeliveryAssignmentRow>("delivery_assignments", "id, store_id, order_id, order_source, delivery_agent_id, status", 100)
  ]);
  const deliveryAgent =
    deliveryAgents.find((agent) => agent.store_id === testStore?.id && looksLikeTest(agent.name, agent.email, agent.status)) ??
    deliveryAgents.find((agent) => looksLikeTest(agent.name, agent.email, agent.status, agent.availability_status)) ??
    deliveryAgents[0] ??
    null;
  const activeAssignment =
    assignments.find(
      (assignment) =>
        assignment.store_id === testStore?.id &&
        assignment.order_id === testOrder?.id &&
        assignment.delivery_agent_id === deliveryAgent?.id
    ) ??
    assignments.find((assignment) => assignment.order_id === testOrder?.id) ??
    assignments.find((assignment) => assignment.delivery_agent_id === deliveryAgent?.id) ??
    null;
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
  const [
    deliveryProofs,
    codCollections,
    deliveryReturns,
    storeCustomers,
    customerAddresses,
    wishlistItems,
    supportTickets
  ] = await Promise.all([
    safeSelect<DeliveryProofRow>("delivery_proofs", "id, assignment_id", 100),
    safeSelect<DeliveryCodRow>("cod_collections", "id, assignment_id, status", 100),
    safeSelect<DeliveryReturnRow>("delivery_returns", "id, assignment_id, status", 100),
    safeSelect<StoreCustomerRow>("store_customers", "id, store_id, email, phone, last_order_id", 100),
    safeSelect<CustomerAddressRow>("customer_addresses", "id, customer_id", 100),
    safeSelect<StoreWishlistRow>("store_wishlist_items", "id, customer_id", 100),
    safeSelect<StoreSupportTicketRow>("store_support_tickets", "id, store_id, customer_id, customer_email, customer_phone", 100)
  ]);
  const customerPhone = text(testOrder?.customer_phone);
  const customerEmail = text(testOrder?.customer_email, customerAccount?.email ?? "");
  const storeCustomer =
    storeCustomers.find((customer) =>
      customer.store_id === testStore?.id &&
      customerEmail &&
      text(customer.email).toLowerCase() === customerEmail.toLowerCase()
    ) ??
    storeCustomers.find((customer) =>
      customer.store_id === testStore?.id &&
      customerPhone &&
      normalizePhone(customer.phone) === normalizePhone(customerPhone)
    ) ??
    null;
  const proof = deliveryProofs.find((candidate) => candidate.assignment_id === activeAssignment?.id) ?? null;
  const cod = codCollections.find((candidate) => candidate.assignment_id === activeAssignment?.id) ?? null;
  const deliveryReturn = deliveryReturns.find((candidate) => candidate.assignment_id === activeAssignment?.id) ?? null;
  const customerAddress = customerAddresses.find((candidate) => candidate.customer_id === storeCustomer?.id) ?? null;
  const wishlist = wishlistItems.find((candidate) => candidate.customer_id === storeCustomer?.id) ?? null;
  const supportTicket =
    supportTickets.find((ticket) => ticket.customer_id === storeCustomer?.id) ??
    supportTickets.find((ticket) =>
      ticket.store_id === testStore?.id &&
      customerEmail &&
      text(ticket.customer_email).toLowerCase() === customerEmail.toLowerCase()
    ) ??
    supportTickets.find((ticket) =>
      ticket.store_id === testStore?.id &&
      customerPhone &&
      normalizePhone(ticket.customer_phone) === normalizePhone(customerPhone)
    ) ??
    null;
  const ownerLinkedToStore = Boolean(
    testStore &&
      ownerAccount?.status === "available" &&
      (testStore.ownerId === ownerAccount.id || testStore.ownerEmail.toLowerCase() === ownerAccount.email.toLowerCase())
  );
  const productLinkedToStore = Boolean(testStore && testProduct?.store_id === testStore.id);
  const customerLinkedToOrder = Boolean(
    testOrder &&
      (text(testOrder.customer_email).toLowerCase() === customerAccount?.email.toLowerCase() ||
        (storeCustomer && storeCustomer.store_id === testStore?.id))
  );
  const deliveryLinkedToStore = Boolean(testStore && deliveryAgent?.store_id === testStore.id);
  const deliveryLinkedToOrder = Boolean(
    activeAssignment &&
      activeAssignment.order_id === testOrder?.id &&
      activeAssignment.delivery_agent_id === deliveryAgent?.id
  );
  const resellerLinkedToListing = testReseller ? reseller.registryStatus === "available" : false;
  const adminCanMonitor = Boolean(accounts[0].status === "available" && (testStore || testOrder || deliveryAgent || storeCustomer));
  const orderStatus = text(testOrder?.order_status, "missing");
  const fulfillmentStatus = text(testOrder?.fulfillment_status, "missing");
  const assignmentStatus = text(activeAssignment?.status, "missing");
  const delivered = assignmentStatus === "delivered" || Boolean(proof);
  const returned = assignmentStatus === "returned" || Boolean(deliveryReturn);
  const customerPortalHref = store.slug
    ? `/store/${store.slug}/account${customerPhone ? `?phone=${encodeURIComponent(customerPhone)}` : ""}`
    : "#customer-flow";
  const trackingHref = store.slug && testOrder
    ? `/store/${store.slug}/track?reference=${encodeURIComponent(testOrder.id)}${customerPhone ? `&phone=${encodeURIComponent(customerPhone)}` : ""}`
    : "#customer-flow";
  const productHref = store.slug && testProduct ? `/store/${store.slug}/product/${testProduct.id}` : "#product-registry";
  const orderHref = "/admin/orders";
  const workflowMap = [
    workflowItem("Customer Test", customerAccount?.status === "available", customerAccount?.status ?? "missing", customerAccount?.email ?? "Not found"),
    workflowItem("Test Product", productLinkedToStore, product.registryStatus, product.name),
    workflowItem("Test Order", Boolean(testOrder), orderStatus, testOrder?.id ?? "No test order yet"),
    workflowItem("Owner Fulfillment", ownerLinkedToStore, fulfillmentStatus, store.owner),
    workflowItem("Delivery Assignment", deliveryLinkedToOrder, assignmentStatus, delivery.agent),
    workflowItem("Delivery Status", deliveryLinkedToOrder, delivery.currentStatus, activeAssignment?.id ?? "No assignment yet"),
    workflowItem("Admin Monitoring", adminCanMonitor, adminCanMonitor ? "visible" : "missing", "Read-only admin registry")
  ];
  const orderFlow = [
    workflowItem("No test order yet", !testOrder, testOrder ? "created" : "waiting", testOrder ? "A real order exists." : "Waiting for a real test order."),
    workflowItem("Order created", Boolean(testOrder), orderStatus, testOrder?.id ?? "No order record found."),
    workflowItem("Order confirmed", ["confirmed", "processing", "fulfilled", "delivered"].includes(orderStatus), orderStatus, "Uses the existing order status."),
    workflowItem("Fulfillment pending", Boolean(testOrder) && ["pending", "unfulfilled", "missing"].includes(fulfillmentStatus), fulfillmentStatus, "Uses the existing fulfillment status."),
    workflowItem("Delivery assigned", Boolean(activeAssignment), assignmentStatus, activeAssignment?.id ?? "No delivery assignment."),
    workflowItem("Delivery in progress", ["accepted", "picked_up"].includes(assignmentStatus), assignmentStatus, "Existing delivery lifecycle status."),
    workflowItem("Delivered", delivered, delivered ? "delivered" : assignmentStatus, proof?.id ?? "No delivery proof yet."),
    workflowItem("Returned", returned, deliveryReturn?.status ?? assignmentStatus, deliveryReturn?.id ?? "No return record.")
  ];
  const deliveryFlow = [
    workflowItem("Delivery agent linked", deliveryLinkedToStore, delivery.status, delivery.agent),
    workflowItem("Order assigned", deliveryLinkedToOrder, assignmentStatus, activeAssignment?.id ?? "No assignment."),
    workflowItem("Status lifecycle", Boolean(activeAssignment), assignmentStatus, "assigned -> accepted -> picked_up -> delivered/returned"),
    workflowItem("Proof submitted", Boolean(proof), proof ? "submitted" : "missing", proof?.id ?? "No proof record."),
    workflowItem("COD collected", cod?.status === "collected" || cod?.status === "settled_to_store", cod?.status ?? "missing", cod?.id ?? "No COD collection."),
    workflowItem("Return status", Boolean(deliveryReturn), deliveryReturn?.status ?? "none", deliveryReturn?.id ?? "No return record.")
  ];
  const customerFlow = [
    workflowItem("Customer phone/email linked", Boolean(customerEmail || customerPhone), customerEmail || customerPhone ? "linked" : "missing", customerEmail || customerPhone || "No customer contact."),
    workflowItem("Order visible in customer account", Boolean(storeCustomer && testOrder), storeCustomer ? "visible" : "missing", storeCustomer?.id ?? "No store customer profile."),
    workflowItem("Tracking visible", Boolean(testOrder && customerPhone), testOrder ? "available" : "missing", trackingHref),
    workflowItem("Support visible", Boolean(supportTicket), supportTicket ? "available" : "not created", supportTicket?.id ?? "No support ticket."),
    workflowItem("Wishlist/address available", Boolean(wishlist || customerAddress), wishlist || customerAddress ? "available" : "not created", customerAddress?.id ?? wishlist?.id ?? "No wishlist or address record.")
  ];
  const adminMonitoring = [
    workflowItem("Order visible", Boolean(testOrder), orderStatus, orderHref),
    workflowItem("Store visible", Boolean(testStore), store.status, store.id),
    workflowItem("Customer visible", Boolean(storeCustomer), storeCustomer?.id ? "visible" : "missing", storeCustomer?.id ?? "No store customer."),
    workflowItem("Delivery visible", Boolean(deliveryAgent), delivery.currentStatus, delivery.id),
    workflowItem("Workflow health", workflowMap.every((item) => item.ok), `${workflowMap.filter((item) => item.ok).length}/${workflowMap.length}`, "End-to-end real table coverage.")
  ];
  const resellerFlow = [
    workflowItem("Reseller test account linked", accounts[2].status === "available", accounts[2].status, accounts[2].email),
    workflowItem("Template/listing exists", resellerLinkedToListing, reseller.registryStatus, reseller.marketplaceListing),
    workflowItem("Future store sale workflow prepared", true, "reserved", "Real reseller sale activation remains disabled.")
  ];
  const workflowHealth = [
    workflowItem("Owner linked to store", ownerLinkedToStore, ownerLinkedToStore ? "linked" : "missing", store.owner),
    workflowItem("Product linked to store", productLinkedToStore, productLinkedToStore ? "linked" : "missing", product.name),
    workflowItem("Customer linked to order", customerLinkedToOrder, customerLinkedToOrder ? "linked" : "missing", customerEmail || "No customer contact."),
    workflowItem("Delivery linked to store", deliveryLinkedToStore, deliveryLinkedToStore ? "linked" : "missing", delivery.agent),
    workflowItem("Delivery linked to order", deliveryLinkedToOrder, deliveryLinkedToOrder ? "linked" : "missing", activeAssignment?.id ?? "No assignment."),
    workflowItem("Admin can monitor", adminCanMonitor, adminCanMonitor ? "visible" : "missing", "Admin registry data loaded."),
    workflowItem("Reseller linked to listing", resellerLinkedToListing, reseller.registryStatus, reseller.marketplaceListing)
  ];
  const shortcuts = [
    { href: store.registryStatus === "available" ? linkedStore.href : "#store-registry", label: "Open Test Store", note: "Admin store registry" },
    { href: productHref, label: "Open Product", note: "Existing product route or registry" },
    { href: orderHref, label: "Open Test Order", note: "Admin orders" },
    { href: "/dashboard", label: "Open Owner Dashboard", note: "Existing owner route, no impersonation" },
    { href: customerPortalHref, label: "Open Customer Portal", note: "Existing storefront account portal" },
    { href: "/delivery/dashboard", label: "Open Delivery Dashboard", note: "Existing delivery route, no impersonation" },
    { href: "/reseller/dashboard", label: "Open Reseller Dashboard", note: "Existing reseller route, no sale activation" }
  ];
  const health = [
    { label: "Admin exists", ok: accounts[0].status === "available" },
    { label: "Owner exists", ok: accounts[1].status === "available" },
    { label: "Reseller exists", ok: accounts[2].status === "available" },
    { label: "Customer exists", ok: accounts[3].status === "available" },
    { label: "Delivery exists", ok: accounts[4].status === "available" }
  ];

  return {
    adminMonitoring,
    accounts,
    customerFlow,
    delivery,
    deliveryFlow,
    health,
    order,
    orderFlow,
    product,
    reseller,
    resellerFlow,
    shortcuts,
    store,
    workflowHealth,
    workflowMap
  };
}
