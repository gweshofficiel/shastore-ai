import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveDeliveryAgent,
  saveShippingMethod
} from "@/lib/commerce-operations/actions";
import type {
  CommerceOperationsScope,
  DeliveryAgent,
  ShippingMethod
} from "@/lib/commerce-operations/types";

function listPreview(value: unknown) {
  return Array.isArray(value) && value.length ? value.map((item) => String(item)).join(", ") : "All regions";
}

function money(value: number) {
  return Number(value ?? 0).toFixed(2);
}

export function ShippingOperationsPanel({
  agents,
  returnPath,
  scope,
  shippingMethods
}: {
  agents: DeliveryAgent[];
  returnPath: string;
  scope: CommerceOperationsScope;
  shippingMethods: ShippingMethod[];
}) {
  return (
    <div className="grid gap-6 lg:gap-8">
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Shipping System Foundation
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Add shipping method
        </h2>
        <form action={saveShippingMethod} className="mt-5 grid gap-4">
          <input name="scope" type="hidden" value={scope} />
          <input name="returnTo" type="hidden" value={returnPath} />
          <div className="grid gap-4 md:grid-cols-3">
            <Input id="methodName" label="Method name" name="methodName" placeholder="Standard delivery" required />
            <Input id="flatFee" label="Flat shipping fee" name="flatFee" placeholder="5.00" type="number" />
            <Input id="estimatedDeliveryTime" label="Estimated delivery time" name="estimatedDeliveryTime" placeholder="2-4 business days" />
            <Input id="preparationDelayDays" label="Preparation delay days" name="preparationDelayDays" placeholder="1" type="number" />
            <Input id="estimatedDeliveryDays" label="Estimated delivery days" name="estimatedDeliveryDays" placeholder="3" type="number" />
            <Input id="sortOrder" label="Sort order" name="sortOrder" placeholder="0" type="number" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              id="shippingRegions"
              label="Shipping regions"
              name="shippingRegions"
              placeholder="Casablanca&#10;Dubai&#10;United States"
            />
            <Textarea
              id="deliveryNotes"
              label="Delivery notes"
              name="deliveryNotes"
              placeholder="Future courier, label printing, tracking, and multi-warehouse notes."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["enabled", "Enable method"],
              ["freeShippingEnabled", "Free shipping"],
              ["localDeliveryEnabled", "Local delivery"],
              ["pickupEnabled", "Pickup placeholder"],
              ["codSupported", "COD shipping support"]
            ].map(([name, label]) => (
              <label
                className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink"
                key={name}
              >
                <input defaultChecked={name === "enabled" || name === "codSupported"} name={name} type="checkbox" />
                {label}
              </label>
            ))}
          </div>
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
            Future integrations can attach real shipping APIs, courier tracking, label printing,
            automated shipping rules, and multi-warehouse routing to these methods.
          </div>
          <div>
            <Button type="submit">Save shipping method</Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Shipping Cards
          </p>
          <div className="mt-5 grid gap-3">
            {shippingMethods.length ? (
              shippingMethods.map((method) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={method.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-ink">{method.method_name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {method.free_shipping_enabled ? "Free shipping" : `$${money(method.flat_fee)} flat fee`}
                        {" "}· {method.estimated_delivery_time ?? `${method.estimated_delivery_days} days`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                        method.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {method.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    <span className="rounded-full bg-white px-3 py-1">{listPreview(method.shipping_regions)}</span>
                    {method.local_delivery_enabled ? <span className="rounded-full bg-white px-3 py-1">Local delivery</span> : null}
                    {method.pickup_enabled ? <span className="rounded-full bg-white px-3 py-1">Pickup placeholder</span> : null}
                    {method.cod_supported ? <span className="rounded-full bg-white px-3 py-1">COD supported</span> : null}
                  </div>
                  {method.delivery_notes ? (
                    <p className="mt-3 text-sm leading-6 text-muted">{method.delivery_notes}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                No shipping methods yet.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Delivery Agents
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            Add delivery agent
          </h2>
          <form action={saveDeliveryAgent} className="mt-5 grid gap-4">
            <input name="scope" type="hidden" value={scope} />
            <input name="returnTo" type="hidden" value={returnPath} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input id="agentName" label="Agent name" name="agentName" placeholder="Driver name" required />
              <Input id="phone" label="Phone" name="phone" placeholder="+1 555 000 0000" />
              <Input id="city" label="City" name="city" placeholder="City" />
              <Input id="vehicleType" label="Vehicle type placeholder" name="vehicleType" placeholder="Bike, car, van" />
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink md:col-span-2">
                Status
                <select
                  className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  name="status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <Textarea
              id="notes"
              label="Delivery status / assignment placeholder notes"
              name="notes"
              placeholder="Future order assignment, delivery status, and tracking notes."
            />
            <Button type="submit">Save delivery agent</Button>
          </form>
          <div className="mt-6 grid gap-3">
            {agents.length ? (
              agents.map((agent) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={agent.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-ink">{agent.agent_name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {[agent.city, agent.phone, agent.vehicle_type].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                      agent.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                  {agent.notes ? <p className="mt-3 text-sm leading-6 text-muted">{agent.notes}</p> : null}
                </div>
              ))
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                No delivery agents yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
