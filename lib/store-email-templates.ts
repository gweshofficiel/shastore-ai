export type StoreEmailTemplateKey =
  | "abandoned_cart_recovery"
  | "customer_welcome"
  | "low_stock_alert"
  | "order_confirmation"
  | "order_status_update"
  | "review_reminder"
  | "review_request"
  | "thank_you";

type StoreEmailTemplateMetadata = Record<string, unknown>;

type StoreEmailTemplate = {
  html: string;
  subject: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function moneyValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }

  return null;
}

function currencyMoneyValue(value: unknown, currency: unknown) {
  const amount = moneyValue(value);
  const code = textValue(currency, "USD");

  return amount ? `${code} ${amount}` : null;
}

function optionalLine(label: string, value: string | null) {
  return value ? `${label}: ${value}` : null;
}

function htmlLine(label: string, value: string | null) {
  return value
    ? `<p style="margin:4px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    : "";
}

export function getStoreEmailTemplate(
  templateKey: StoreEmailTemplateKey,
  metadata: StoreEmailTemplateMetadata = {}
): StoreEmailTemplate {
  const storeName = textValue(metadata.storeName, "the store");
  const orderReference = textValue(metadata.orderReference, "your order");
  const customerName = textValue(metadata.customerName, "Customer");
  const orderStatus = textValue(metadata.orderStatus, "updated");
  const total = moneyValue(metadata.totalAmount);
  const currencyTotal = currencyMoneyValue(metadata.totalAmount, metadata.currency);
  const orderDate = textValue(metadata.orderDate);
  const productsSummary = textValue(metadata.productsSummary);
  const subtotal = currencyMoneyValue(metadata.subtotalAmount, metadata.currency);
  const shipping = currencyMoneyValue(metadata.shippingAmount, metadata.currency);
  const discountAmount = moneyValue(metadata.discountAmount);
  const discount = discountAmount && Number(discountAmount) > 0
    ? currencyMoneyValue(metadata.discountAmount, metadata.currency)
    : null;
  const fulfillmentStatus = textValue(metadata.fulfillmentStatus);
  const receiptUrl = textValue(metadata.receiptUrl);
  const cartRecoveryUrl = textValue(metadata.cartRecoveryUrl);
  const estimatedTotal = currencyMoneyValue(metadata.estimatedTotal, metadata.currency);
  const productName = textValue(metadata.productName, "A product");
  const stockQuantity = textValue(metadata.stockQuantity, "low stock");
  const orderUrl = textValue(metadata.orderUrl);
  let content: { htmlDetails?: string; subject: string; text: string };

  if (templateKey === "abandoned_cart_recovery") {
    const lines = [
      `Hello ${customerName}, you left items in your cart at ${storeName}.`,
      optionalLine("Products", productsSummary),
      optionalLine("Estimated total", estimatedTotal),
      cartRecoveryUrl ? `Recover your cart: ${cartRecoveryUrl}` : null
    ].filter(Boolean);

    content = {
      subject: `Complete your cart at ${storeName}`,
      text: lines.join("\n"),
      htmlDetails: [
        htmlLine("Products", productsSummary),
        htmlLine("Estimated total", estimatedTotal)
      ].join("")
    };
  } else if (templateKey === "order_status_update") {
    content = {
      subject: `Order ${orderReference} status updated`,
      text: `Hello ${customerName}, your order ${orderReference} at ${storeName} is now ${orderStatus}.`
    };
  } else if (templateKey === "review_request") {
    content = {
      subject: `How was your order from ${storeName}?`,
      text: `Hello ${customerName}, thank you for your order ${orderReference}. You can leave a product review from your order page.`
    };
  } else if (templateKey === "review_reminder") {
    content = {
      subject: `Reminder: review your order from ${storeName}`,
      text: `Hello ${customerName}, we hope you are enjoying your order ${orderReference}. You can leave a product review from your order page.`
    };
  } else if (templateKey === "low_stock_alert") {
    content = {
      subject: `Low stock alert: ${productName}`,
      text: `${productName} has ${stockQuantity} units remaining in ${storeName}.`
    };
  } else if (templateKey === "customer_welcome") {
    content = {
      subject: `Welcome to ${storeName}`,
      text: `Hello ${customerName}, welcome to ${storeName}. Thank you for placing your first order with us.`
    };
  } else if (templateKey === "thank_you") {
    content = {
      subject: `Thank you for your order from ${storeName}`,
      text: `Hello ${customerName}, thank you for your order ${orderReference}. We are preparing it now.`
    };
  } else {
    const receiptLink = receiptUrl || orderUrl;
    const lines = [
      `Hello ${customerName}, your order ${orderReference} at ${storeName} has been received.`,
      optionalLine("Order date", orderDate),
      optionalLine("Products", productsSummary),
      optionalLine("Subtotal", subtotal),
      optionalLine("Shipping", shipping),
      optionalLine("Discount", discount),
      optionalLine("Grand total", currencyTotal ?? total),
      optionalLine("Fulfillment", fulfillmentStatus),
      receiptLink ? `Receipt: ${receiptLink}` : null
    ].filter(Boolean);

    content = {
      subject: `Order ${orderReference} received`,
      text: lines.join("\n"),
      htmlDetails: [
        htmlLine("Order date", orderDate),
        htmlLine("Products", productsSummary),
        htmlLine("Subtotal", subtotal),
        htmlLine("Shipping", shipping),
        htmlLine("Discount", discount),
        htmlLine("Grand total", currencyTotal ?? total),
        htmlLine("Fulfillment", fulfillmentStatus)
      ].join("")
    };
  }

  const safeText = escapeHtml(content.text);
  const safeStoreName = escapeHtml(storeName);
  const safeOrderUrl = escapeHtml(cartRecoveryUrl || receiptUrl || orderUrl);

  return {
    ...content,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;"><p>${safeText.replace(/\n/g, "<br />")}</p>${content.htmlDetails ? `<div style="margin:18px 0;padding:16px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">${content.htmlDetails}</div>` : ""}${safeOrderUrl ? `<p><a href="${safeOrderUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">View receipt</a></p>` : ""}<p style="color:#64748b;">Thank you,<br />${safeStoreName}</p></div>`
  };
}
