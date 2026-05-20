"use client";

import { useState } from "react";
import type { AiLandingCopy, ProductInput } from "@/types/landing";

type CopyGenerationInput = ProductInput & {
  templateId?: string;
  tone?: string;
};

export function useCopyGeneration() {
  const [copy, setCopy] = useState<AiLandingCopy | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateCopy(product: CopyGenerationInput) {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to generate copy");
      }

      const nextCopy = (await response.json()) as AiLandingCopy;
      setCopy(nextCopy);
      return nextCopy;
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate copy";
      setError(message);
      throw generationError;
    } finally {
      setIsGenerating(false);
    }
  }

  return { copy, error, generateCopy, isGenerating };
}
