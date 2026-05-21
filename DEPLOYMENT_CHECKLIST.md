# SHASTORE AI Production Deployment Checklist

Use this checklist before deploying SHASTORE AI to Vercel production. This is preparation only; do not deploy until each production item is verified.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key for browser/server clients.
- `OPENAI_API_KEY`: Required for AI copy generation.

## Production URL Variables

- `NEXT_PUBLIC_APP_URL`: Canonical production app URL, for example `https://app.shastore.ai`.
- `NEXT_PUBLIC_SITE_URL`: Public marketing/app URL used by sitemap and robots.
- `VERCEL_URL`: Provided automatically by Vercel preview and production deployments.
- `NEXT_PUBLIC_SHASTORE_DOMAIN`: Base domain for free subdomains, for example `shastore.ai`.
- `NEXT_PUBLIC_PLATFORM_DOMAIN`: Legacy platform domain placeholder if older code references it.

## Optional Platform Billing Stripe

- `PLATFORM_BILLING_STRIPE_SECRET_KEY`
- `PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET`
- `PLATFORM_BILLING_STRIPE_PRICE_ID`
- `PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER`
- `PLATFORM_BILLING_STRIPE_PRICE_ID_PRO`
- `PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY`

These are SHASTORE AI owner keys for SaaS subscription billing only. Client store
Stripe credentials are separate seller-owned placeholders and must not be used for
platform billing or buyer checkout.

## Optional Domain Placeholders

- `HOSTINSH_API_KEY`: Required only when live HOSTINSH DNS verification is enabled.
- `HOSTINSH_DNS_TARGET`: CNAME target shown to users, for example `cname.vercel-dns.com`.

## Supabase Migrations

Apply the safe migrations in order before production traffic:

- `supabase/migrations/store-system-safe.sql`
- `supabase/migrations/unified-commerce-safe.sql`
- `supabase/migrations/unified-checkout-safe.sql`
- `supabase/migrations/fix-published-stores-visibility-safe.sql`
- `supabase/migrations/analytics-events-safe.sql`
- `supabase/migrations/billing-engine-safe.sql`
- `supabase/migrations/domain-publishing-safe.sql`

Do not run production without confirming these migrations completed successfully.

## Vercel Setup

- Create a Vercel project connected to the repository.
- Set framework preset to Next.js.
- Add all required environment variables in Vercel Project Settings.
- Add optional platform billing Stripe and HOSTINSH variables only when those services are ready.
- Confirm `NEXT_PUBLIC_APP_URL` uses the final production domain.
- Confirm Vercel build command is `npm run build`.
- Confirm install command is the project default or `npm install`.

## Exact Vercel Environment Variables

Required for first production deployment:

```env
NEXT_PUBLIC_APP_URL=https://app.shastore.ai
NEXT_PUBLIC_SITE_URL=https://app.shastore.ai
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Recommended placeholders to add now, even if values are empty until integrations go live:

```env
SUPABASE_SERVICE_ROLE_KEY=
PLATFORM_BILLING_STRIPE_SECRET_KEY=
PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET=
PLATFORM_BILLING_STRIPE_PRICE_ID=
PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER=
PLATFORM_BILLING_STRIPE_PRICE_ID_PRO=
PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY=
NEXT_PUBLIC_PLATFORM_DOMAIN=shastore.ai
NEXT_PUBLIC_SHASTORE_DOMAIN=shastore.ai
HOSTINSH_API_KEY=
HOSTINSH_DNS_TARGET=cname.vercel-dns.com
```

## Auth Redirects

- In Supabase Auth settings, add the production site URL.
- Add callback/redirect URLs for production and preview domains.
- Keep local development redirects such as `http://localhost:3000` while developing.
- Verify login, register, and dashboard redirects after deployment.

Exact Supabase Auth URLs to configure:

```text
Site URL:
https://app.shastore.ai

Redirect URLs:
http://localhost:3000/**
http://localhost:3001/**
https://app.shastore.ai/**
https://*.vercel.app/**
https://*.shastore.ai/**
```

Production callback URLs to verify manually:

```text
https://app.shastore.ai/login
https://app.shastore.ai/register
https://app.shastore.ai/dashboard
https://app.shastore.ai/api/auth/callback
```

## Production Testing

- Run `npm run build` locally before deployment.
- Check `/api/health` and confirm `status` is `ok`.
- Confirm `/api/health` reports `deploymentMode` as `production` on production and `preview` on Vercel previews.
- Verify `/dashboard` loads for an authenticated user.
- Verify `/admin` loads only for allowed admin users.
- Verify `/l/[slug]` renders a published landing page.
- Verify `/store/[slug]` renders a published store.
- Verify checkout opens and order capture still works.
- Verify analytics tracking does not block page rendering.
- Verify billing remains in placeholder mode if platform billing Stripe keys are absent.
- Verify domain dashboard can show DNS instructions without live HOSTINSH credentials.

## Rollback Steps

- Keep the previous Vercel deployment available.
- If production fails, use Vercel instant rollback to the last healthy deployment.
- Do not roll back Supabase with destructive SQL.
- If a migration issue is found, add a new safe forward migration.
- Recheck `/api/health`, auth redirects, public landing/store pages, and checkout after rollback.

## Safety Notes

- Do not deploy with missing required Supabase or OpenAI variables.
- Do not expose server-only secrets through `NEXT_PUBLIC_*`; only public browser-safe values should use that prefix.
- Do not enable live SaaS billing until platform billing Stripe checkout and webhook secrets are configured.
- Do not enable live domain verification until HOSTINSH API credentials and DNS target are confirmed.
- Do not remove local development fallbacks; they keep `npm run dev` working.
- Do not run production traffic until all required Supabase migrations have been applied and verified.
