import { NextResponse } from "next/server";
import {
  syncYouCanPayPlatformWebhook,
  verifyYouCanPayWebhookSignature
} from "@/lib/billing/youcan-pay-platform";
import { recordWebhookEvent } from "@/lib/integrations/webhook-monitoring";
import type { YouCanPayWebhookPayload } from "@/lib/billing/youcan-pay-platform";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-youcanpay-signature");

  console.info("youcan webhook received", {
    hasSignature: Boolean(signature)
  });
  await recordWebhookEvent({
    eventType: "youcan_pay.webhook",
    httpStatus: null,
    providerKey: "youcan_pay",
    safePayloadSummary: {
      bodyLength: rawBody.length,
      hasSignature: Boolean(signature)
    },
    status: "received",
    webhookType: "youcan_pay_webhook"
  });

  if (!verifyYouCanPayWebhookSignature(rawBody, signature)) {
    console.warn("youcan webhook rejected", {
      reason: signature ? "invalid_signature" : "missing_signature"
    });
    await recordWebhookEvent({
      errorCode: signature ? "invalid_signature" : "missing_signature",
      errorMessage: "Invalid YouCan Pay signature.",
      eventType: "youcan_pay.webhook",
      httpStatus: 400,
      providerKey: "youcan_pay",
      safePayloadSummary: {
        bodyLength: rawBody.length,
        hasSignature: Boolean(signature)
      },
      status: "failed",
      webhookType: "youcan_pay_webhook"
    });
    return NextResponse.json({ ok: false, error: "Invalid YouCan Pay signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as YouCanPayWebhookPayload;
    const result = await syncYouCanPayPlatformWebhook(payload);
    const eventName = payload.event_name ?? payload.event?.name ?? "youcan_pay.event.unknown";
    const transactionId = payload.payload?.transaction?.id ?? null;
    await recordWebhookEvent({
      eventType: eventName,
      httpStatus: 200,
      providerKey: "youcan_pay",
      relatedEntityId: payload.id ?? transactionId ?? null,
      relatedEntityType: "youcan_pay_webhook_event",
      safePayloadSummary: {
        activated: result.activated,
        eventId: payload.id ?? null,
        eventName,
        reason: result.reason,
        transactionId
      },
      status: result.activated ? "processed" : "ignored",
      webhookType: "youcan_pay_webhook"
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      await recordWebhookEvent({
        errorCode: "invalid_json",
        errorMessage: "Invalid YouCan Pay webhook JSON.",
        eventType: "youcan_pay.webhook",
        httpStatus: 400,
        providerKey: "youcan_pay",
        safePayloadSummary: {
          bodyLength: rawBody.length,
          hasSignature: Boolean(signature)
        },
        status: "failed",
        webhookType: "youcan_pay_webhook"
      });
      return NextResponse.json({ ok: false, error: "Invalid YouCan Pay webhook JSON" }, { status: 400 });
    }

    console.error("youcan activation failed", {
      message: error instanceof Error ? error.message : String(error)
    });

    await recordWebhookEvent({
      errorCode: "processing_failed",
      errorMessage: "YouCan Pay webhook could not be processed.",
      eventType: "youcan_pay.webhook",
      httpStatus: 500,
      providerKey: "youcan_pay",
      safePayloadSummary: {
        bodyLength: rawBody.length,
        hasSignature: Boolean(signature)
      },
      status: "failed",
      webhookType: "youcan_pay_webhook"
    });

    return NextResponse.json(
      { ok: false, error: "YouCan Pay webhook could not be processed" },
      { status: 500 }
    );
  }
}
