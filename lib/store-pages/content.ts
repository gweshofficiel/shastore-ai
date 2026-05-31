const blockedTagPattern = /<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link)[^>]*>/gi;
const eventAttributePattern = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const dangerousHrefPattern = /\s+(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi;
const allowedTagPattern =
  /<\/?(p|br|div|strong|b|em|i|u|h1|h2|h3|h4|ul|ol|li|a|img|blockquote)[^>]*>/gi;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripUnsafeAttributes(tag: string) {
  return tag
    .replace(eventAttributePattern, "")
    .replace(dangerousHrefPattern, "")
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function sanitizePageContent(value: string | null | undefined) {
  const content = value ?? "";

  return content
    .replace(blockedTagPattern, "")
    .replace(/<[^>]+>/g, (tag) => {
      const normalized = tag.toLowerCase();
      allowedTagPattern.lastIndex = 0;
      return allowedTagPattern.test(normalized) ? stripUnsafeAttributes(tag) : "";
    })
    .slice(0, 100000);
}

export function textFromPageContent(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pageContentFromForm(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return sanitizePageContent(value.slice(0, 100000));
}

/** HTML safe for public rendering; falls back to escaped plain text when needed. */
export function preparePageContentForRender(value: string | null | undefined) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) {
    return "";
  }

  const sanitized = sanitizePageContent(raw);
  const sanitizedText = textFromPageContent(sanitized);

  if (sanitizedText) {
    return sanitized;
  }

  const plainText = textFromPageContent(raw) || raw.trim();
  if (!plainText) {
    return "";
  }

  return plainText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
