export function summarizeUserAgent(userAgent: string | null | undefined) {
  const agent = userAgent?.trim() ?? "";

  if (!agent) {
    return {
      browserLabel: "Unknown browser",
      deviceLabel: "Unknown device"
    };
  }

  const lowered = agent.toLowerCase();
  const deviceLabel = /mobile|android|iphone|ipad|tablet/i.test(agent)
    ? "Mobile"
    : /windows|macintosh|linux|cros/i.test(agent)
      ? "Desktop"
      : "Unknown device";

  let browserLabel = "Unknown browser";

  if (lowered.includes("edg/")) {
    browserLabel = "Microsoft Edge";
  } else if (lowered.includes("chrome/") && !lowered.includes("chromium")) {
    browserLabel = "Chrome";
  } else if (lowered.includes("firefox/")) {
    browserLabel = "Firefox";
  } else if (lowered.includes("safari/") && !lowered.includes("chrome/")) {
    browserLabel = "Safari";
  } else if (lowered.includes("opr/") || lowered.includes("opera")) {
    browserLabel = "Opera";
  }

  return { browserLabel, deviceLabel };
}
