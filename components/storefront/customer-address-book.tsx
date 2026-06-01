"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CustomerAddress = {
  address_line1: string;
  address_line2: string | null;
  city: string;
  country: string;
  full_name: string | null;
  id: string;
  is_default: boolean;
  notes: string | null;
  phone: string | null;
  postal_code: string | null;
};

type AddressFormState = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  fullName: string;
  isDefault: boolean;
  notes: string;
  phone: string;
  postalCode: string;
};

const emptyForm: AddressFormState = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "",
  fullName: "",
  isDefault: false,
  notes: "",
  phone: "",
  postalCode: ""
};

function formFromAddress(address: CustomerAddress): AddressFormState {
  return {
    addressLine1: address.address_line1,
    addressLine2: address.address_line2 ?? "",
    city: address.city,
    country: address.country,
    fullName: address.full_name ?? "",
    isDefault: address.is_default,
    notes: address.notes ?? "",
    phone: address.phone ?? "",
    postalCode: address.postal_code ?? ""
  };
}

export function CustomerAddressBook({
  customerPhone,
  slug,
  storeId
}: {
  customerPhone: string;
  slug: string;
  storeId: string;
}) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>({ ...emptyForm, phone: customerPhone });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canManageAddresses = Boolean(customerPhone.trim());
  const params = useMemo(
    () =>
      new URLSearchParams({
        phone: customerPhone,
        slug,
        storeId
      }),
    [customerPhone, slug, storeId]
  );

  const loadAddresses = useCallback(async () => {
    if (!canManageAddresses) {
      setAddresses([]);
      return;
    }

    const response = await fetch(`/api/store-addresses?${params.toString()}`, {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    setAddresses(Array.isArray(payload?.addresses) ? payload.addresses : []);
  }, [canManageAddresses, params]);

  useEffect(() => {
    setForm((current) => ({ ...current, phone: current.phone || customerPhone }));
    void loadAddresses();
  }, [customerPhone, loadAddresses]);

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageAddresses) {
      setMessage("Enter your checkout phone number before saving addresses.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const response = await fetch("/api/store-addresses", {
      body: JSON.stringify({
        action: "save",
        addressId: editingId,
        customerPhone,
        slug,
        storeId,
        ...form
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "Address could not be saved.");
      setIsLoading(false);
      return;
    }

    setEditingId(null);
    setForm({ ...emptyForm, phone: customerPhone });
    await loadAddresses();
    setMessage("Address saved.");
    setIsLoading(false);
  }

  async function runAddressAction(action: "default" | "delete", addressId: string) {
    setIsLoading(true);
    setMessage(null);
    const response = await fetch("/api/store-addresses", {
      body: JSON.stringify({
        action,
        addressId,
        customerPhone,
        slug,
        storeId
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "Address action failed.");
    } else {
      await loadAddresses();
      setMessage(action === "delete" ? "Address deleted." : "Default address updated.");
    }

    setIsLoading(false);
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      <form className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submitAddress}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            {editingId ? "Edit address" : "Add address"}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Saved addresses are scoped to this store account and prepared for future checkout reuse.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AddressInput label="Full name" onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} required value={form.fullName} />
          <AddressInput label="Phone" onChange={(value) => setForm((current) => ({ ...current, phone: value }))} required value={form.phone} />
          <AddressInput label="Country" onChange={(value) => setForm((current) => ({ ...current, country: value }))} required value={form.country} />
          <AddressInput label="City" onChange={(value) => setForm((current) => ({ ...current, city: value }))} required value={form.city} />
          <AddressInput className="sm:col-span-2" label="Address line 1" onChange={(value) => setForm((current) => ({ ...current, addressLine1: value }))} required value={form.addressLine1} />
          <AddressInput className="sm:col-span-2" label="Address line 2" onChange={(value) => setForm((current) => ({ ...current, addressLine2: value }))} value={form.addressLine2} />
          <AddressInput label="Postal code" onChange={(value) => setForm((current) => ({ ...current, postalCode: value }))} value={form.postalCode} />
        </div>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Notes</span>
          <textarea
            className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            maxLength={500}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Delivery instructions, landmark, building access"
            value={form.notes}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          <input
            checked={form.isDefault}
            className="h-4 w-4 rounded border-slate-300"
            onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
            type="checkbox"
          />
          Mark as default address
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || !canManageAddresses}
            type="submit"
          >
            {editingId ? "Save changes" : "Add address"}
          </button>
          {editingId ? (
            <button
              className="h-11 rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-muted transition hover:bg-slate-50"
              onClick={() => {
                setEditingId(null);
                setForm({ ...emptyForm, phone: customerPhone });
              }}
              type="button"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {addresses.length ? (
        <div className="grid gap-3">
          {addresses.map((address) => (
            <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={address.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black tracking-[-0.03em] text-ink">
                      {address.full_name || "Delivery address"}
                    </h3>
                    {address.is_default ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-muted">
                    {address.address_line1}
                    {address.address_line2 ? `, ${address.address_line2}` : ""}
                    <br />
                    {[address.city, address.country, address.postal_code].filter(Boolean).join(", ")}
                    <br />
                    {address.phone || "No phone"}
                  </p>
                  {address.notes ? (
                    <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted">
                      {address.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted transition hover:bg-slate-200"
                    onClick={() => {
                      setEditingId(address.id);
                      setForm(formFromAddress(address));
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  {!address.is_default ? (
                    <button
                      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted transition hover:bg-slate-200"
                      onClick={() => void runAddressAction("default", address.id)}
                      type="button"
                    >
                      Make default
                    </button>
                  ) : null}
                  <button
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-700 transition hover:bg-red-100"
                    onClick={() => void runAddressAction("delete", address.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No saved addresses</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
            Add a delivery address to make future checkout reuse possible.
          </p>
        </div>
      )}
    </div>
  );
}

function AddressInput({
  className,
  label,
  onChange,
  required,
  value
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-semibold text-ink ${className ?? ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        maxLength={240}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}
