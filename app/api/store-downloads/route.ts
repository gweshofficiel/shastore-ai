import { NextRequest, NextResponse } from "next/server";
import { createCustomerDownloadUrl } from "@/lib/customer-downloads";

function cleanText(value: string | null, maxLength = 160) {
  return (value ?? "").trim().slice(0, maxLength);
}

function redirectToDownloads(request: NextRequest, slug: string, phone: string, status: string) {
  const params = new URLSearchParams();
  if (phone) {
    params.set("phone", phone);
  }
  params.set("download", status);

  return NextResponse.redirect(
    new URL(`/store/${encodeURIComponent(slug || "store")}/account/downloads?${params.toString()}`, request.url),
    303
  );
}

export async function GET(request: NextRequest) {
  const slug = cleanText(request.nextUrl.searchParams.get("slug"), 120).toLowerCase();
  const phone = cleanText(request.nextUrl.searchParams.get("phone"), 80);
  const orderId = cleanText(request.nextUrl.searchParams.get("orderId"), 80);
  const productId = cleanText(request.nextUrl.searchParams.get("productId"), 80);
  const source = cleanText(request.nextUrl.searchParams.get("source"), 40);

  if (!slug || !phone || !orderId || !productId || (source !== "orders" && source !== "store_orders")) {
    return redirectToDownloads(request, slug, phone, "missing");
  }

  const result = await createCustomerDownloadUrl({
    orderId,
    phone,
    productId,
    slug,
    source
  });

  if (!result.url) {
    const status = result.error?.includes("not configured") ? "unavailable" : "denied";
    return redirectToDownloads(request, slug, phone, status);
  }

  return NextResponse.redirect(result.url, 303);
}
