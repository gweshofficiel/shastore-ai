"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyStoreUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    const absoluteUrl =
      typeof window === "undefined" ? url : new URL(url, window.location.origin).toString();

    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button onClick={copyUrl} type="button" variant="secondary">
      {copied ? "Copied" : "Copy URL"}
    </Button>
  );
}
