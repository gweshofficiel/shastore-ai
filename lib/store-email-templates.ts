export type StoreEmailTemplateKey =
  | "customer_welcome"
  | "low_stock_alert"
  | "order_confirmation"
  | "order_status_update"
  | "review_request";

type StoreEmailTemplateMetadata = Record<string, unknown>;

type StoreEmailTemplate = {
  subject: string;
  text: string;
};

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

  if (templateKey === "order_status_update") {
    return {
      subject: `Order ${orderReference} status updated`,
      text: `Hello ${customerName}, your order ${orderReference} at ${storeName} is now ${orderStatus}.`
    };
  }

  if (templateKey === "review_request") {
    return {
      subject: `How was your order from ${storeName}?`,
      text: `Hello ${customerName}, thank you for your order ${orderReference}. You can leave a product review from your order page.`
    };
  }

  if (templateKey === "low_stock_alert") {
    return {
      subject: `Low stock alert: ${productName}`,
      text: `${productName} has ${stockQuantity} units remaining in ${storeName}.`
    };
  }

  if (templateKey === "customer_welcome") {
    return {
      subject: `Welcome to ${storeName}`,
      text: `Hello ${customerName}, welcome to ${storeName}.`
    };
  }

  return {
    subject: `Order ${orderReference} received`,
    text: `Hello ${customerName}, your order ${orderReference} at ${storeName} has been received${total ? ` with total ${total}` : ""}.`
  };
}
