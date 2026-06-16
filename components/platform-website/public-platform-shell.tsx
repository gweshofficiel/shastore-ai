import type { CSSProperties, ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { PlatformThemeProvider } from "@/components/platform-theme/platform-theme-provider";
import {
  buildPlatformLocaleThemeAttributes,
  getPlatformLocaleTheme
} from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import type { PlatformThemeBranding } from "@/src/lib/platform-theme/platform-theme-runtime";
import type { PlatformWhiteLabelShellProps } from "@/src/lib/platform-theme/platform-white-label";

export function buildPublicPlatformThemeStyle(branding: PlatformThemeBranding, locale?: string | null): CSSProperties {
  const localeTheme = getPlatformLocaleTheme(locale);

  return {
    ...branding.cssVariables,
    fontFamily: localeTheme.fontFamily
  } as CSSProperties;
}

export function PublicPlatformShell({
  branding,
  children,
  locale,
  whiteLabel
}: {
  branding: PlatformThemeBranding;
  children: ReactNode;
  locale?: string | null;
  whiteLabel: PlatformWhiteLabelShellProps;
}) {
  const localeThemeAttributes = buildPlatformLocaleThemeAttributes(locale);

  return (
    <PlatformThemeProvider branding={branding}>
      <div
        className={localeThemeAttributes.className}
        dir={localeThemeAttributes.dir}
        lang={localeThemeAttributes.lang}
        style={buildPublicPlatformThemeStyle(branding, locale)}
      >
        <MarketingNavbar logoUrl={branding.logoUrl} {...whiteLabel} />
        <main className="bg-canvas">{children}</main>
        <MarketingFooter {...whiteLabel} />
      </div>
    </PlatformThemeProvider>
  );
}
