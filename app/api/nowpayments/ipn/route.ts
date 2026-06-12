import { NextResponse } from "next/server";
import {
  syncNowPaymentsPlatformPayment,
  verifyNowPaymentsIpnSignature
} from "@/lib/billing/nowpayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  console.info("[nowpayments_ipn_received]", {
    bodyLength: rawBody.length,
    hasSignature: Boolean(signature)
  });

  if (!verifyNowPaymentsIpnSignature(rawBody, signature)) {
    console.error("[nowpayments-platform] invalid IPN signature", {
      hasSignature: Boolean(signature)
    });
    return NextResponse.json({ error: "Invalid NOWPayments signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as Parameters<typeof syncNowPaymentsPlatformPayment>[0];

    console.info("[nowpayments_ipn_verified]", {
      orderId: payload.order_id ?? null,
      paymentId: payload.payment_id ?? null,
      paymentStatus: payload.payment_status ?? null
    });

    const result = await syncNowPaymentsPlatformPayment(payload);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[nowpayments_plan_activation_failed]", {
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "NOWPayments IPN processing failed" }, { status: 500 });
  }
}
