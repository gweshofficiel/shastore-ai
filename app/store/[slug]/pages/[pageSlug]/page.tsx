import {
  generatePublicStorePageMetadata,
  PublicStorePage
} from "@/components/storefront/public-store-page";

export const dynamic = "force-dynamic";

type StoreCustomPageProps = {
  params: Promise<{ pageSlug: string; slug: string }>;
};

export async function generateMetadata({ params }: StoreCustomPageProps) {
  const { pageSlug, slug } = await params;
  return generatePublicStorePageMetadata({ pageSlug, slug });
}

export default async function StoreCustomPage({ params }: StoreCustomPageProps) {
  const { pageSlug, slug } = await params;
  return <PublicStorePage pageSlug={pageSlug} slug={slug} />;
}
