import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreCouponAction,
  updateStoreCouponStatusAction
} from "@/lib/store-coupon-actions";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type CouponRow = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  ends_at?: string | null;
  id: string;
  minimum_order_amount?: number | string | null;
  starts_at?: string | null;
  status: string;
  store_id: string;
  usage_limit?: number | null;
  used_count: number;
};

function formatDiscount(coupon: CouponRow) {
  return coupon.discount_type === "percentage"
    ? `${Number(coupon.discount_value)}%`
    : Number(coupon.discount_value).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No limit";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage coupons for that store.",
    created: "Coupon created.",
    duplicate: "A coupon with that code already exists for this store.",
    invalid: "Enter a valid coupon code and discount value.",
    "invalid-percentage": "Percentage coupons cannot exceed 100%.",
    updated: "Coupon updated.",
    "update-failed": "Coupon could not be updated."
  };

  return value ? messages[value] ?? null : null;
}

export default async function CouponsPage({
  searchParams
}: {
  searchParams: Promise<{ coupons?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Create store-scoped discounts for public checkout."
          title="Coupons"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to manage coupons.</p>
        </Card>
      </div>
    );
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);
  const canEdit = hasPermission(role, "can_edit_stores");

  if (!canEdit) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Create store-scoped discounts for public checkout."
          title="Coupons"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            You do not have permission to manage coupons.
          </p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === query.storeId) ?? stores[0] ?? null;
  const { data: couponRows, error: couponsError } = activeStore
    ? await supabase
        .from("store_coupons" as never)
        .select("id, store_id, code, discount_type, discount_value, status, usage_limit, used_count, minimum_order_amount, starts_at, ends_at")
        .eq("workspace_id" as never, workspaceId as never)
        .eq("store_id" as never, activeStore.id as never)
        .order("created_at" as never, { ascending: false } as never)
    : { data: [], error: null };
  const coupons = (couponRows ?? []) as unknown as CouponRow[];
  const message = statusMessage(query.coupons);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create real store-scoped coupon codes. Validation happens again at checkout before an order is saved."
        title="Coupons"
      />
      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}
      {storesError || couponsError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">
            Coupons could not be loaded. Confirm the coupons migration has been applied.
          </p>
        </Card>
      ) : null}
      {!activeStore ? (
        <Card className="border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-bold text-muted">Create a store before adding coupons.</p>
        </Card>
      ) : (
        <>
          <Card className="p-5 lg:p-6">
            <form className="flex flex-wrap items-end gap-3" method="get">
              <label className="grid min-w-64 gap-2 text-sm font-semibold text-ink">
                <span>Store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name || store.store_name || "Untitled store"}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View coupons
              </Button>
            </form>
          </Card>
          <Card className="p-5 lg:p-6">
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Create coupon for {activeStore.name || activeStore.store_name || "this store"}
            </h2>
            <form action={createStoreCouponAction} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <div className="grid gap-4 md:grid-cols-4">
                <Input id="coupon-code" label="Code" name="code" placeholder="WELCOME10" required />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Discount type</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="discountType"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                <Input id="discount-value" label="Discount value" min="0" name="discountValue" required step="0.01" type="number" />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Status</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <Input id="usage-limit" label="Usage limit" min="0" name="usageLimit" placeholder="Unlimited" type="number" />
                <Input id="minimum-order" label="Minimum order amount" min="0" name="minimumOrderAmount" step="0.01" type="number" />
                <Input id="starts-at" label="Start date" name="startsAt" type="datetime-local" />
                <Input id="ends-at" label="End date" name="endsAt" type="datetime-local" />
              </div>
              <Button className="w-fit" type="submit">
                Create coupon
              </Button>
            </form>
          </Card>
          <div className="grid gap-4">
            {coupons.length ? (
              coupons.map((coupon) => (
                <Card className="p-5" key={coupon.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black tracking-[-0.02em] text-ink">{coupon.code}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                          {coupon.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-muted">
                        {formatDiscount(coupon)} off · Used {coupon.used_count}
                        {coupon.usage_limit === null || coupon.usage_limit === undefined
                          ? " / unlimited"
                          : ` / ${coupon.usage_limit}`}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        Minimum {Number(coupon.minimum_order_amount ?? 0).toFixed(2)} · Starts {formatDate(coupon.starts_at)} · Ends {formatDate(coupon.ends_at)}
                      </p>
                    </div>
                    <form action={updateStoreCouponStatusAction}>
                      <input name="couponId" type="hidden" value={coupon.id} />
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input
                        name="status"
                        type="hidden"
                        value={coupon.status === "active" ? "inactive" : "active"}
                      />
                      <Button type="submit" variant="secondary">
                        {coupon.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-bold text-muted">No coupons yet for this store.</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
