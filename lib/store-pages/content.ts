const blockedTagPattern = /<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link)[^>]*>/gi;
const eventAttributePattern = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const dangerousHrefPattern = /\s+(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi;
const allowedTagPattern = /<\/?(p|br|strong|b|em|i|u|h1|h2|h3|h4|ul|ol|li|a|img|blockquote)[^>]*>/gi;

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
