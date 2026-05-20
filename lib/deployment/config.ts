export type EnvCheck = {
  key: string;
  configured: boolean;
  required: boolean;
  scope: "app" | "supabase" | "openai" | "stripe" | "domains";
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
    key: "STRIPE_SECRET_KEY",
    configured: Boolean(process.env.STRIPE_SECRET_KEY),
    required: false,
    scope: "stripe",
    note: "Optional until live billing is enabled."
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    required: false,
    scope: "stripe",
    note: "Required only when Stripe webhooks are live."
  },
  {
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    configured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    required: false,
    scope: "stripe",
    note: "Browser-side Stripe key for future hosted billing flows."
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

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return withProtocol(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return withProtocol(process.env.NEXT_PUBLIC_SITE_URL);
  }

  if (process.env.VERCEL_URL) {
    return withProtocol(process.env.VERCEL_URL);
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
