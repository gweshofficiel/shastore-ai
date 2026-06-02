import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontLanguageSwitcher } from "@/components/storefront/language-switcher";
import { submitStoreContactMessage } from "@/lib/store-contact-actions";
import { loadPublicStoreContact } from "@/lib/store-contact-public";

export const dynamic = "force-dynamic";

type StoreContactPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ contact?: string }>;
};

function phoneHref(value: string | null) {
  const normalized = value?.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function whatsappHref(value: string | null, storeTitle: string) {
  const number = value?.replace(/\D/g, "");

  if (!number) {
    return null;
  }

  const text = encodeURIComponent(`Hi ${storeTitle}, I have a question about your store.`);
  return `https://wa.me/${number}?text=${text}`;
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    failed: "Your message could not be sent. Please try again.",
    invalid: "Please provide a valid name, email, subject, and message.",
    "not-configured": "The contact form is temporarily unavailable.",
    sent: "Thanks. Your message has been sent to the store owner."
  };

  return status ? messages[status] : null;
}

export async function generateMetadata({
  params
}: StoreContactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await loadPublicStoreContact(slug);

  if (!preview) {
    return {
      title: "Contact not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const description = `Contact ${preview.store.title}.`;

  return {
    title: `Contact | ${preview.store.title}`,
    description,
    openGraph: {
      description,
      title: `Contact | ${preview.store.title}`,
      type: "website"
    },
    twitter: {
      card: "summary",
      description,
      title: `Contact | ${preview.store.title}`
    }
  };
}

export default async function StoreContactPage({
  params,
  searchParams
}: StoreContactPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const { contactMessage, preview } = await loadPublicStoreContact(slug);

  if (!preview) {
    notFound();
  }

  const store = preview.store;
  const contactEmail = store.supportEmail?.trim() || store.storeEmail?.trim() || null;
  const contactPhoneHref = phoneHref(store.supportPhone);
  const contactWhatsappHref = whatsappHref(store.whatsappNumber, store.title);
  const message = statusMessage(query.contact);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="fixed right-4 top-4 z-50">
        <StorefrontLanguageSwitcher settings={preview.store.languageSettings} />
      </div>
      <section className="mx-auto max-w-6xl">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${store.slug}`}
        >
          Back to {store.title}
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Contact
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
              Contact {store.title}
            </h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-muted">
              {contactMessage ||
                "Send a message to the store owner. They will respond using the contact details you provide."}
            </p>

            <div className="mt-6 grid gap-3">
              <ContactDetail
                href={contactEmail ? `mailto:${contactEmail}` : null}
                label="Email"
                value={contactEmail}
              />
              <ContactDetail
                href={contactPhoneHref}
                label="Phone"
                value={store.supportPhone}
              />
              <ContactDetail
                href={contactWhatsappHref}
                label="WhatsApp"
                value={store.whatsappNumber}
              />
              <ContactDetail label="Address" value={store.businessAddress} />
              <ContactDetail label="Business hours" value={store.businessHours} />
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              Send a message
            </h2>
            {message ? (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
                {message}
              </div>
            ) : null}
            <form action={submitStoreContactMessage} className="mt-5 grid gap-4">
              <input name="slug" type="hidden" value={store.slug} />
              <input name="storeId" type="hidden" value={store.id} />
              <input name="workspaceId" type="hidden" value={store.workspaceId ?? ""} />
              <label className="hidden">
                Website
                <input autoComplete="off" name="website" tabIndex={-1} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Name</span>
                  <input
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={160}
                    name="name"
                    placeholder="Your name"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Email</span>
                  <input
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={180}
                    name="email"
                    placeholder="you@example.com"
                    required
                    type="email"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Subject</span>
                <input
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  maxLength={220}
                  name="subject"
                  placeholder="How can we help?"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Message</span>
                <textarea
                  className="min-h-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  maxLength={4000}
                  name="message"
                  placeholder="Write your message."
                  required
                />
              </label>
              <button
                className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
                type="submit"
              >
                Send message
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

function ContactDetail({
  href,
  label,
  value
}: {
  href?: string | null;
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  const content = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-ink">
        {value}
      </p>
    </div>
  );

  return href ? (
    <a className="block transition hover:-translate-y-0.5" href={href} rel="noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>
      {content}
    </a>
  ) : (
    content
  );
}
