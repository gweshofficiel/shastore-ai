"use client";

import { useState } from "react";

type VisualTheme = {
  accent: string;
  primary: string;
  secondary: string;
};

function CategoryVisualFallback({
  accentColor,
  categoryName,
  className,
  theme
}: {
  accentColor: string;
  categoryName: string;
  className: string;
  theme: VisualTheme;
}) {
  return (
    <div
      aria-label={categoryName}
      className={`relative overflow-hidden ${className}`}
      role="img"
      style={{
        background: `radial-gradient(circle at 20% 20%, ${accentColor}33, transparent 28%), radial-gradient(circle at 82% 18%, ${theme.secondary}2e, transparent 26%), linear-gradient(135deg, ${theme.primary}14, ${theme.secondary}22)`
      }}
    >
      <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-white/50 blur-2xl" />
      <div className="absolute bottom-6 right-6 h-24 w-24 rounded-[2rem] border border-white/70 bg-white/45 shadow-2xl" />
      <div className="absolute bottom-12 left-8 h-3 w-28 rounded-full bg-white/70" />
      <div className="absolute bottom-7 left-8 h-2 w-40 rounded-full bg-white/45" />
    </div>
  );
}

export function CategoryVisualImage({
  accentColor,
  categoryName,
  className,
  imageUrl,
  theme
}: {
  accentColor: string;
  categoryName: string;
  className: string;
  imageUrl: string;
  theme: VisualTheme;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <CategoryVisualFallback
        accentColor={accentColor}
        categoryName={categoryName}
        className={className}
        theme={theme}
      />
    );
  }

  return (
    <img
      alt={categoryName}
      className={`${className} w-full object-cover`}
      onError={() => setFailed(true)}
      src={imageUrl}
    />
  );
}
