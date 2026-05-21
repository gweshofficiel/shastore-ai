import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResellerShowcaseRenderer } from "@/components/reseller-showcase/showcase-renderer";
import { getPublicResellerShowcase } from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const showcase = await getPublicResellerShowcase(slug);

  if (!showcase) {
    return {};
  }

  return {
    title: `${showcase.profile.display_name} | SHASTORE AI Reseller`,
    description:
      showcase.profile.bio ??
      "A reseller marketplace of ready-made stores and templates built with SHASTORE AI.",
    openGraph: {
      title: showcase.profile.display_name,
      description: showcase.profile.bio ?? undefined,
      images: showcase.profile.banner_url ? [showcase.profile.banner_url] : undefined,
      type: "website"
    }
  };
}

export default async function PublicResellerShowcasePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const showcase = await getPublicResellerShowcase(slug);

  if (!showcase) {
    notFound();
  }

  return <ResellerShowcaseRenderer showcase={showcase} />;
}
