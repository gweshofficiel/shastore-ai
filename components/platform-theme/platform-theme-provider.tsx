"use client";

import { createContext, useContext } from "react";
import type { PlatformThemeBranding } from "@/src/lib/platform-theme/platform-theme-runtime";

const PlatformThemeContext = createContext<PlatformThemeBranding | null>(null);

export function PlatformThemeProvider({
  branding,
  children
}: {
  branding: PlatformThemeBranding;
  children: React.ReactNode;
}) {
  return <PlatformThemeContext.Provider value={branding}>{children}</PlatformThemeContext.Provider>;
}

export function usePlatformTheme() {
  const context = useContext(PlatformThemeContext);

  if (!context) {
    return null;
  }

  return context;
}
