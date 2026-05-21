"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitStorePurchaseRequest,
  type StorePurchaseFormState
} from "@/lib/store-purchase/actions";

const initialState: StorePurchaseFormState = {
  message: "",
  status: "idle"
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? "Sending request..." : "Send purchase request"}
    </Button>
  );
}

export function StorePurchasePanel({
  contactHref,
  demoUrl,
  premium,
  priceLabel,
  resellerId,
  showcaseItemId,
  storeTitle,
  templateId
}: {
  contactHref: string;
  demoUrl: string | null;
  premium: boolean;
  priceLabel: string | null;
  resellerId: string;
  showcaseItemId: string;
  storeTitle: string;
  templateId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(submitStorePurchaseRequest, initialState);

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-black">{priceLabel ?? "Pricing on request"}</p>
          <Button onClick={() => setIsOpen(true)} type="button">
            Buy this store
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {demoUrl ? (
            <Link
              className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-black ${
                premium ? "bg-white text-slate-950" : "bg-slate-950 text-white"
              }`}
              href={demoUrl}
              target="_blank"
            >
              Preview store
            </Link>
          ) : null}
          <Link
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-black ${
              premium
                ? "border-white/20 bg-white/10 text-white"
                : "border-slate-200 bg-white text-slate-950"
            }`}
            href={contactHref}
          >
            Contact reseller
          </Link>
        </div>
      </div>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
          role="dialog"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/20 bg-white p-5 text-slate-950 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.95)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-500">
                  Store Purchase Request
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-ink">
                  Buy {storeTitle}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Send your details to the reseller. Payment, deployment, and ownership transfer are
                  prepared after approval.
                </p>
              </div>
              <button
                className="self-start rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-ink transition hover:bg-slate-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            {state.status === "success" ? (
              <div className="mt-6 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-lg font-black text-emerald-950">Request submitted</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
                  {state.message}
                </p>
                <Button className="mt-4" onClick={() => setIsOpen(false)} type="button">
                  Done
                </Button>
              </div>
            ) : (
              <form action={formAction} className="mt-6 grid gap-5">
                <input name="resellerId" type="hidden" value={resellerId} />
                <input name="showcaseItemId" type="hidden" value={showcaseItemId} />
                <input name="templateId" type="hidden" value={templateId ?? ""} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    id={`buyerName-${showcaseItemId}`}
                    label="Buyer name"
                    name="buyerName"
                    placeholder="Sarah Founder"
                    required
                  />
                  <Input
                    id={`buyerEmail-${showcaseItemId}`}
                    label="Buyer email"
                    name="buyerEmail"
                    placeholder="buyer@example.com"
                    required
                    type="email"
                  />
                  <Input
                    id={`buyerPhone-${showcaseItemId}`}
                    label="Phone"
                    name="buyerPhone"
                    placeholder="+1 555 0100"
                  />
                  <Input
                    id={`buyerWhatsapp-${showcaseItemId}`}
                    label="WhatsApp"
                    name="buyerWhatsapp"
                    placeholder="+1 555 0100"
                  />
                  <Input
                    id={`businessName-${showcaseItemId}`}
                    label="Business name"
                    name="businessName"
                    placeholder="Bright Home Studio"
                    required
                  />
                  <Input
                    id={`requestedDomain-${showcaseItemId}`}
                    label="Requested domain"
                    name="requestedDomain"
                    placeholder="brightstore.com"
                  />
                </div>
                <Textarea
                  id={`notes-${showcaseItemId}`}
                  label="Notes"
                  name="notes"
                  placeholder="Tell the reseller about launch timing, branding, domain, or transfer requirements."
                />
                {state.status === "error" ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {state.message}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold leading-5 text-slate-600">
                    This creates a reseller purchase request only. It does not trigger buyer
                    checkout, subscriptions, shipping, or payment automation.
                  </p>
                  <SubmitButton />
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
