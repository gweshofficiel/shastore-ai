export type EnvCheck = {
  key: string;
  configured: boolean;
  required: boolean;
  scope: "app" | "supabase" | "openai" | "platform-billing" | "domains";
  note: string;
};

const requiredEnv: EnvCheck[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    required: true,
    scope: "supabase",
    note: "Supabase project URL used by server and browser clients."
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    required: true,
    scope: "supabase",
    note: "Public Supabase anon key for auth and RLS-protected reads/writes."
  },
  {
    key: "OPENAI_API_KEY",
    configured: Boolean(process.env.OPENAI_API_KEY),
    required: true,
    scope: "openai",
    note: "Required for AI copy generation endpoints."
  }
];

const optionalEnv: EnvCheck[] = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    configured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    required: false,
    scope: "app",
    note: "Preferred canonical app URL. Falls back to VERCEL_URL or localhost."
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    configured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    required: false,
    scope: "app",
    note: "SEO sitemap/robots base URL when different from app URL."
  },
  {
    key: "VERCEL_URL",
    configured: Boolean(process.env.VERCEL_URL),
    required: false,
    scope: "app",
    note: "Automatically provided by Vercel preview and production deployments."
  },
  {
    key: "PLATFORM_BILLING_STRIPE_SECRET_KEY",
    configured: Boolean(process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY),
    required: false,
    scope: "platform-billing",
    note: "SHASTORE AI Stripe secret key for SaaS subscription billing only."
  },
  {
    key: "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET",
    configured: Boolean(process.env.PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET),
    required: false,
    scope: "platform-billing",
    note: "Required only when platform billing Stripe webhooks are live."
  },
  {
    key: "PLATFORM_BILLING_STRIPE_PRICE_ID_PRO",
    configured: Boolean(process.env.PLATFORM_BILLING_STRIPE_PRICE_ID_PRO),
    required: false,
    scope: "platform-billing",
    note: "Pro SaaS subscription price ID for SHASTORE AI platform billing."
  },
  {
    key: "PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER",
    configured: Boolean(process.env.PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER),
    required: false,
    scope: "platform-billing",
    note: "Starter SaaS subscription price ID for SHASTORE AI platform billing."
  },
  {
    key: "PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY",
    configured: Boolean(process.env.PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY),
    required: false,
    scope: "platform-billing",
    note: "Agency SaaS subscription price ID for SHASTORE AI platform billing."
  },
  {
    key: "NEXT_PUBLIC_SHASTORE_DOMAIN",
    configured: Boolean(process.env.NEXT_PUBLIC_SHASTORE_DOMAIN),
    required: false,
    scope: "domains",
    note: "Base domain for free subdomains such as brand.shastore.ai."
  },
  {
    key: "HOSTINSH_API_KEY",
    configured: Boolean(process.env.HOSTINSH_API_KEY),
    required: false,
    scope: "domains",
    note: "Optional until live HOSTINSH DNS verification is enabled."
  },
  {
    key: "HOSTINSH_DNS_TARGET",
    configured: Boolean(process.env.HOSTINSH_DNS_TARGET),
    required: false,
    scope: "domains",
    note: "CNAME target shown in domain DNS instructions."
  }
];

function withProtocol(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/+$/, "");
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

export function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function isLocalhostHost(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function envAppBaseUrl() {
  for (const key of ["NEXT_PUBLIC_APP_URL", "PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
    const value = process.env[key]?.trim();

    if (!value) {
      continue;
    }

    const baseUrl = withProtocol(value);

    if (isProduction() && isLocalhostHost(baseUrl)) {
      continue;
    }

    return baseUrl;
  }

  if (process.env.VERCEL_URL) {
    return withProtocol(process.env.VERCEL_URL);
  }

  if (isProduction()) {
    return null;
  }

  return "http://localhost:3000";
}

export function getAppBaseUrl() {
  const resolved = envAppBaseUrl();

  if (resolved) {
    return resolved;
  }

  if (process.env.VERCEL_URL) {
    return withProtocol(process.env.VERCEL_URL);
  }

  return "http://localhost:3000";
}

export async function resolveAppBaseUrl() {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

    if (host) {
      const normalizedHost = host.split(",")[0]?.trim();

      if (normalizedHost && !isLocalhostHost(`https://${normalizedHost}`)) {
        const proto =
          headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
          (isProduction() ? "https" : "http");

        return `${proto}://${normalizedHost}`;
      }
    }
  } catch {
    // headers() is unavailable outside a request context.
  }

  const fromEnv = envAppBaseUrl();

  if (fromEnv) {
    return fromEnv;
  }

  if (isProduction()) {
    throw new Error("App base URL is not configured for production.");
  }

  return "http://localhost:3000";
}

export function getPublicUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function validateRequiredEnv() {
  const checks = [...requiredEnv, ...optionalEnv];
  const missingRequired = checks.filter((check) => check.required && !check.configured);

  return {
    ok: missingRequired.length === 0,
    checks,
    missingRequired: missingRequired.map((check) => check.key)
  };
}

export function getEnvironmentMode() {
  if (process.env.VERCEL_ENV === "preview") {
    return "preview";
  }

  if (isProduction()) {
    return "production";
  }

  return "localhost";
}

export function getDeploymentDiagnostics() {
  const env = validateRequiredEnv();

  return {
    appBaseUrl: getAppBaseUrl(),
    environmentMode: getEnvironmentMode(),
    missingRequiredEnv: env.missingRequired,
    requiredEnvOk: env.ok,
    vercelDetected: Boolean(process.env.VERCEL),
    vercelEnv: process.env.VERCEL_ENV ?? null
  };
}
