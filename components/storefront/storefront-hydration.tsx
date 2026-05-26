"use client";

import { useEffect } from "react";

export function StorefrontHydration({
  layoutKey,
  slug,
  templateId
}: {
  layoutKey: string;
  slug: string;
  templateId: string;
}) {
  useEffect(() => {
    document.documentElement.dataset.storefrontSlug = slug;
    document.documentElement.dataset.storefrontTemplate = templateId;
    document.documentElement.dataset.storefrontLayout = layoutKey;
    window.dispatchEvent(
      new CustomEvent("shastore-storefront-hydrated", {
        detail: { layoutKey, slug, templateId }
      })
    );
  }, [layoutKey, slug, templateId]);

  return null;
}
