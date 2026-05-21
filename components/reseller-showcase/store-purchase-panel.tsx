"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitStorePurchaseRequest,
  type StorePurchaseFormState
} from "@/lib/store-purchase/actions";

const initialFormState: StorePurchaseFormState = {
  message: "",
  status: "idle"
};

type StorePurchasePanelProps = {
  contactHref: string;
  demoUrl: string | null;
  premium: boolean;
  priceLabel: string | null;
  resellerId: string;
  showcaseItemId: string;
  storeTitle: string;
  templateId: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? "Sending request..." : "Send purchase request"}
    </Button>
  );
}

function StorePurchaseModal({
  onClose,
  resellerId,
  showcaseItemId,
  storeTitle,
  templateId
}: Pick<
  StorePurchasePanelProps,
  "resellerId" | "showcaseItemId" | "storeTitle" | "templateId"
> & {
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [buyerHasAccount, setBuyerHasAccount] = useState(false);
  const [state, formAction, isPending] = useActionState(
    submitStorePurchaseRequest,
    initialFormState
  );

  useEffect(() => {
    setMounted(true);
    const frame = window.requestAnimationFrame(() => setVisible(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  const handleClose = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => onClose(), 180);
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className={`fixed inset-0 z-[100] grid place-items-center px-4 py-6 transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        className={`relative z-[101] max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/20 bg-white p-5 text-slate-950 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.95)] transition-all duration-200 ease-out sm:p-7 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
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
            onClick={handleClose}
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
            <Button className="mt-4" disabled={isPending} onClick={handleClose} type="button">
              Done
            </Button>
          </div>
        ) : (
          <form action={formAction} className="mt-6 grid gap-5">
            <input name="resellerId" type="hidden" value={resellerId} />
            <input name="showcaseItemId" type="hidden" value={showcaseItemId} />
            <input name="templateId" type="hidden" value={templateId ?? ""} />
            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-950">
                Do you already have a SHASTORE AI account?
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-white p-3 text-sm font-bold text-blue-950">
                  <input
                    checked={!buyerHasAccount}
                    className="mt-1"
                    name="buyerHasAccount"
                    onChange={() => setBuyerHasAccount(false)}
                    type="radio"
                    value="no"
                  />
                  No, create a new buyer account placeholder
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-white p-3 text-sm font-bold text-blue-950">
                  <input
                    checked={buyerHasAccount}
                    className="mt-1"
                    name="buyerHasAccount"
                    onChange={() => setBuyerHasAccount(true)}
                    type="radio"
                    value="yes"
                  />
                  Yes, I have an account ID
                </label>
              </div>
              {buyerHasAccount ? (
                <div className="mt-4">
                  <Input
                    id={`targetAccountId-${showcaseItemId}`}
                    label="SHASTORE Account ID"
                    name="targetAccountId"
                    pattern="SHA[0-9]{9}U"
                    placeholder="SHA216290173U"
                    required
                  />
                  <p className="mt-2 text-xs font-semibold leading-5 text-blue-800">
                    Only buyer/customer account IDs ending in U can be used for transfer targeting.
                    Lookup confirms status only and never exposes private account details.
                  </p>
                </div>
              ) : null}
            </div>
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
                This creates a reseller purchase request only. It does not trigger buyer checkout,
                subscriptions, shipping, or payment automation.
              </p>
              <SubmitButton />
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
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
}: StorePurchasePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-black">{priceLabel ?? "Pricing on request"}</p>
          <Button onClick={openModal} type="button">
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
        <StorePurchaseModal
          onClose={closeModal}
          resellerId={resellerId}
          showcaseItemId={showcaseItemId}
          storeTitle={storeTitle}
          templateId={templateId}
        />
      ) : null}
    </>
  );
}
