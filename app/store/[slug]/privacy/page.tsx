import {
  generateStoreLegalMetadata,
  StoreLegalPage
} from "@/components/storefront/public-store-legal-page";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LegalPageProps) {
  const { slug } = await params;
  return generateStoreLegalMetadata({ kind: "privacy", slug });
}

export default async function StorePrivacyPage({ params }: LegalPageProps) {
  const { slug } = await params;
  return <StoreLegalPage kind="privacy" slug={slug} />;
}
