export type StoreEmailTemplateKey =
  | "customer_welcome"
  | "low_stock_alert"
  | "order_confirmation"
  | "order_status_update"
  | "review_request";

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

export function getStoreEmailTemplate(
  templateKey: StoreEmailTemplateKey,
  metadata: StoreEmailTemplateMetadata = {}
): StoreEmailTemplate {
  const storeName = textValue(metadata.storeName, "the store");
  const orderReference = textValue(metadata.orderReference, "your order");
  const customerName = textValue(metadata.customerName, "Customer");
  const orderStatus = textValue(metadata.orderStatus, "updated");
  const total = moneyValue(metadata.totalAmount);
  const productName = textValue(metadata.productName, "A product");
  const stockQuantity = textValue(metadata.stockQuantity, "low stock");
  const orderUrl = textValue(metadata.orderUrl);
  let content: { subject: string; text: string };

  if (templateKey === "order_status_update") {
    content = {
      subject: `Order ${orderReference} status updated`,
      text: `Hello ${customerName}, your order ${orderReference} at ${storeName} is now ${orderStatus}.`
    };
  } else if (templateKey === "review_request") {
    content = {
      subject: `How was your order from ${storeName}?`,
      text: `Hello ${customerName}, thank you for your order ${orderReference}. You can leave a product review from your order page.`
    };
  } else if (templateKey === "low_stock_alert") {
    content = {
      subject: `Low stock alert: ${productName}`,
      text: `${productName} has ${stockQuantity} units remaining in ${storeName}.`
    };
  } else if (templateKey === "customer_welcome") {
    content = {
      subject: `Welcome to ${storeName}`,
      text: `Hello ${customerName}, welcome to ${storeName}.`
    };
  } else {
    content = {
      subject: `Order ${orderReference} received`,
      text: `Hello ${customerName}, your order ${orderReference} at ${storeName} has been received${total ? ` with total ${total}` : ""}.`
    };
  }

  const safeText = escapeHtml(content.text);
  const safeStoreName = escapeHtml(storeName);
  const safeOrderUrl = escapeHtml(orderUrl);

  return {
    ...content,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;"><p>${safeText}</p>${orderUrl ? `<p><a href="${safeOrderUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">View order</a></p>` : ""}<p style="color:#64748b;">Thank you,<br />${safeStoreName}</p></div>`
  };
}
