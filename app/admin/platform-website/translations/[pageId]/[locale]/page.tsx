import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import { getPlatformTranslationEditorContent } from "@/src/lib/platform-website/platform-translation-management";
import { PlatformTranslationForm } from "./platform-translation-form";

type TranslationEditorPageProps = {
  params: Promise<{
    locale: string;
    pageId: string;
  }>;
};

export default async function PlatformTranslationEditorPage({
  params
}: TranslationEditorPageProps) {
  const { locale, pageId } = await params;
  const translation = await getPlatformTranslationEditorContent(pageId, locale);

  if (!translation) {
    return (
      <div className="grid gap-6">
        <AdminHeader
          description="The requested platform translation could not be loaded."
          title="Platform Translation Editor"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Translation error</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">Translation not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Locale must be `en`, `ar`, or `fr`, and the platform page must exist.
          </p>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to platform pages
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Manage stored platform page translations only. No AI generation, public route changes, or customer store translations are touched."
        title={`Edit ${translation.locale} Translation`}
      />
      <PlatformTranslationForm translation={translation} />
    </div>
  );
}
