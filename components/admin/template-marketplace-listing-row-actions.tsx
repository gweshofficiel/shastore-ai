"use client";

type TemplateMarketplaceListingRowActionsProps = {
  archiveAction: (formData: FormData) => void | Promise<void>;
  featuredAction: (formData: FormData) => void | Promise<void>;
  listing: {
    featured: boolean;
    id: string;
    listingStatus: string;
    listingTitle: string;
    templateName: string;
  };
  publishAction: (formData: FormData) => void | Promise<void>;
};

const publishConfirmMessage =
  "Publish this marketplace listing? This makes catalog data visible in the admin preview only. No install, payment, or store mutation occurs.";

const archiveConfirmMessage =
  "Archive this marketplace listing? It will be removed from the published catalog preview.";

export function TemplateMarketplaceListingRowActions({
  archiveAction,
  featuredAction,
  listing,
  publishAction
}: TemplateMarketplaceListingRowActionsProps) {
  const hiddenFields = (
    <>
      <input name="listingId" type="hidden" value={listing.id} />
      <input name="listingTitle" type="hidden" value={listing.listingTitle} />
      <input name="templateName" type="hidden" value={listing.templateName} />
    </>
  );

  return (
    <div className="grid min-w-44 gap-2">
      {listing.listingStatus === "draft" ? (
        <form
          action={publishAction}
          onSubmit={(event) => {
            if (!window.confirm(publishConfirmMessage)) {
              event.preventDefault();
              return;
            }

            const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
            if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
          }}
        >
          {hiddenFields}
          <input name="confirmed" type="hidden" value="" />
          <button
            className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
            type="submit"
          >
            Publish
          </button>
        </form>
      ) : null}

      {listing.listingStatus !== "archived" ? (
        <form
          action={featuredAction}
          onSubmit={(event) => {
            const featuredInput = event.currentTarget.querySelector('input[name="featured"]');
            if (featuredInput instanceof HTMLInputElement) {
              featuredInput.value = listing.featured ? "0" : "1";
            }
          }}
        >
          {hiddenFields}
          <input name="featured" type="hidden" value="" />
          <button
            className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            type="submit"
          >
            {listing.featured ? "Unfeature" : "Mark featured"}
          </button>
        </form>
      ) : null}

      {listing.listingStatus !== "archived" ? (
        <form
          action={archiveAction}
          onSubmit={(event) => {
            if (!window.confirm(archiveConfirmMessage)) {
              event.preventDefault();
              return;
            }

            const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
            if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
          }}
        >
          {hiddenFields}
          <input name="confirmed" type="hidden" value="" />
          <button
            className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
            type="submit"
          >
            Archive
          </button>
        </form>
      ) : (
        <span className="text-xs font-semibold text-slate-400">Archived</span>
      )}
    </div>
  );
}
