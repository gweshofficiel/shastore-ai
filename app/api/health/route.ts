import { NextResponse } from "next/server";
import {
  getDeploymentDiagnostics,
  getAppBaseUrl,
  getEnvironmentMode,
  isProduction,
  validateRequiredEnv
} from "@/lib/deployment/config";

export const dynamic = "force-dynamic";

export function GET() {
  const env = validateRequiredEnv();

  return NextResponse.json({
    status: env.ok ? "ok" : "degraded",
    app: "SHASTORE AI",
    baseUrl: getAppBaseUrl(),
    environment: {
      deploymentMode: getEnvironmentMode(),
      mode: process.env.NODE_ENV ?? "development",
      vercel: Boolean(process.env.VERCEL),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      production: isProduction()
    },
    supabase: {
      configured:
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    },
    requiredEnv: {
      ok: env.ok,
      missing: env.missingRequired
    },
    diagnostics: getDeploymentDiagnostics(),
    timestamp: new Date().toISOString()
  });
}
