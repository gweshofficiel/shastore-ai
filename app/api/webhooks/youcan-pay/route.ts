import { NextResponse } from "next/server";
import {
  syncYouCanPayPlatformWebhook,
  verifyYouCanPayWebhookSignature
} from "@/lib/billing/youcan-pay-platform";
import type { YouCanPayWebhookPayload } from "@/lib/billing/youcan-pay-platform";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-youcanpay-signature");

  console.info("youcan webhook received", {
    hasSignature: Boolean(signature)
  });

  if (!verifyYouCanPayWebhookSignature(rawBody, signature)) {
    console.warn("youcan webhook rejected", {
      reason: signature ? "invalid_signature" : "missing_signature"
    });
    return NextResponse.json({ ok: false, error: "Invalid YouCan Pay signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as YouCanPayWebhookPayload;
    const result = await syncYouCanPayPlatformWebhook(payload);

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid YouCan Pay webhook JSON" }, { status: 400 });
    }

    console.error("youcan activation failed", {
      message: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { ok: false, error: "YouCan Pay webhook could not be processed" },
      { status: 500 }
    );
  }
}
