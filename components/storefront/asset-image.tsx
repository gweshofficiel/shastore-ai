"use client";

import { useState, type CSSProperties } from "react";
import { PremiumVisualFallback } from "@/components/storefront/visual-slots";
import type { ResolvedVisualAsset } from "@/lib/storefront/visual-assets";

type VisualTheme = {
  accent: string;
  primary: string;
  secondary: string;
};

function assetImageStyle(asset: ResolvedVisualAsset): CSSProperties {
  return {
    objectFit: asset.fitMode,
    objectPosition: asset.objectPosition
  };
}

export function StorefrontAssetImage({
  asset,
  className,
  fallbackClassName,
  theme
}: {
  asset: ResolvedVisualAsset;
  className: string;
  fallbackClassName?: string;
  theme: VisualTheme;
}) {
  const [failed, setFailed] = useState(false);

  if (!asset.url || failed) {
    return (
      <PremiumVisualFallback
        accentLabel={asset.state === "coming-soon" ? `${asset.alt} coming soon` : asset.alt}
        className={fallbackClassName ?? className}
        theme={theme}
      />
    );
  }

  return (
    <img
      alt={asset.alt}
      className={className}
      height={asset.height ?? undefined}
      onError={() => setFailed(true)}
      src={asset.url}
      style={assetImageStyle(asset)}
      width={asset.width ?? undefined}
    />
  );
}

export function StorefrontPictureAsset({
  className,
  desktop,
  fallbackClassName,
  mobile,
  theme
}: {
  className: string;
  desktop: ResolvedVisualAsset;
  fallbackClassName?: string;
  mobile?: ResolvedVisualAsset;
  theme: VisualTheme;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = desktop.url ?? mobile?.url ?? null;

  if (!imageUrl || failed) {
    return (
      <PremiumVisualFallback
        accentLabel={desktop.state === "coming-soon" ? `${desktop.alt} coming soon` : desktop.alt}
        className={fallbackClassName ?? className}
        theme={theme}
      />
    );
  }

  return (
    <picture>
      {mobile?.url ? <source media="(max-width: 767px)" srcSet={mobile.url} /> : null}
      <img
        alt={desktop.alt}
        className={className}
        height={desktop.height ?? undefined}
        onError={() => setFailed(true)}
        src={imageUrl}
        style={assetImageStyle(desktop)}
        width={desktop.width ?? undefined}
      />
    </picture>
  );
}

