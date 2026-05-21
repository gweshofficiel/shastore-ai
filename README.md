# SHASTORE AI

Simple production-ready AI SaaS foundation for template-based ecommerce landing pages.

Users upload product images, enter product details, generate AI marketing copy, choose a reusable React template, and publish a landing page with a WhatsApp CTA.

## Stack

- Next.js 15 App Router
- TypeScript
- TailwindCSS
- Supabase auth, database, and storage-ready structure
- Platform billing Stripe checkout and webhook structure for SaaS subscriptions
- OpenAI copy generation endpoint
- Vercel-ready environment configuration

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in Supabase, OpenAI, and SHASTORE AI platform billing Stripe keys.

## Database

Run `supabase/schema.sql` in Supabase SQL editor to create:

- `profiles`
- `landing_pages`
- `subscriptions`
- `product_images`

## Key Routes

- `/`
- `/pricing`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/landings`
- `/dashboard/templates`
- `/dashboard/settings`
- `/dashboard/billing`
- `/l/[slug]`

## Template Rule

AI only generates copy. Landing page structure comes from reusable React templates in `templates/`.
