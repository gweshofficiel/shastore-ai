"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteLandingPage } from "@/lib/landing-management-actions";

export function DeleteLandingButton({
  landingId,
  productName
}: {
  landingId: string;
  productName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button" variant="secondary">
        Delete
      </Button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
              Delete landing page?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              This will permanently delete “{productName}”. This action cannot
              be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                onClick={() => setIsOpen(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <form action={deleteLandingPage}>
                <input name="landingId" type="hidden" value={landingId} />
                <Button type="submit">Confirm delete</Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
