import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PdfPayload = {
  accountMode?: string;
  activationLink?: string;
  buyerEmail?: string;
  buyerName?: string;
  buyerWhatsapp?: string;
  onboardingInstructions?: string[];
  resellerSupportContact?: string;
  storeName?: string;
  storePreviewLink?: string;
  transferCode?: string;
};

function cleanPdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/[()\\]/g, "\\$&");
}

function pdfLine(text: string, x: number, y: number, size = 11) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${cleanPdfText(text)}) Tj ET`;
}

function buildPdf(payload: PdfPayload) {
  const lines = [
    "SHASTORE AI - Manual Store Delivery",
    "",
    `Store name: ${payload.storeName ?? "Prepared store"}`,
    `Buyer name: ${payload.buyerName ?? "Buyer"}`,
    `Buyer email: ${payload.buyerEmail ?? "Not provided"}`,
    `Buyer WhatsApp: ${payload.buyerWhatsapp ?? "Not provided"}`,
    `Transfer code: ${payload.transferCode ?? "Not generated"}`,
    `Account mode: ${payload.accountMode ?? "New buyer account placeholder"}`,
    "",
    `Activation link: ${payload.activationLink ?? "Not generated"}`,
    `Store preview link: ${payload.storePreviewLink ?? "Not generated"}`,
    `Reseller support: ${payload.resellerSupportContact ?? "SHASTORE reseller"}`,
    "",
    "Onboarding instructions:",
    ...(payload.onboardingInstructions ?? []).map((item, index) => `${index + 1}. ${item}`),
    "",
    "Manual test only. No emails, payments, billing data, Stripe secrets, API keys,",
    "shipping records, or admin data are included in this document."
  ];
  const content = lines
    .flatMap((line, index) => {
      const wrapped = line.match(/.{1,88}(\s|$)|\S+/g)?.map((part) => part.trimEnd()) ?? [line];
      return wrapped.map((part, wrapIndex) => ({
        line: part,
        yOffset: index + wrapIndex
      }));
    })
    .map(({ line }, index) => pdfLine(line, 48, 760 - index * 18, index === 0 ? 16 : 10))
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "ascii");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("reseller_profiles" as never)
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: document } = await supabase
    .from("store_delivery_documents" as never)
    .select("pdf_payload, reseller_id")
    .eq("id", documentId)
    .maybeSingle();
  const deliveryDocument = document as { pdf_payload: PdfPayload; reseller_id: string } | null;

  if (!deliveryDocument || deliveryDocument.reseller_id !== (profile as { id: string }).id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = buildPdf(deliveryDocument.pdf_payload);

  return new NextResponse(pdf, {
    headers: {
      "Content-Disposition": "attachment; filename=shastore-store-delivery.pdf",
      "Content-Type": "application/pdf"
    }
  });
}
