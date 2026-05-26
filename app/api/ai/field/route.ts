import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  assertFeatureAccess,
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { getOpenAI } from "@/lib/openai";
import { requireProtectedApiAccess } from "@/lib/workspaces/data-access";

const fieldRequestSchema = z.object({
  field: z.enum(["title", "description", "cta", "seo"]),
  productName: z.string().optional(),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  price: z.string().optional(),
  templateId: z.string().optional()
});

const responseSchema = z.object({
  value: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = fieldRequestSchema.parse(body);
    const accessContext = await requireProtectedApiAccess({
      permission: "can_edit_landings"
    });

    if (accessContext.response || !accessContext.context) {
      return accessContext.response;
    }

    const { supabase, user } = accessContext.context;
    const access = await getUserSubscriptionAccessForClient(supabase, user.id);

    try {
      assertFeatureAccess(access, "ai_generation");
      assertUsageWithinLimits(access, "aiGenerations");
    } catch (error) {
      return NextResponse.json(
        { error: billingEnforcementMessage(error) ?? "AI generation limit reached." },
        { status: 403 }
      );
    }

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "landing_field_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              value: { type: "string" },
              seoTitle: { type: "string" },
              seoDescription: { type: "string" }
            },
            required: ["value", "seoTitle", "seoDescription"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content:
            "You generate concise ecommerce landing page fields. Return structured JSON only."
        },
        {
          role: "user",
          content: `Generate the ${input.field} field for a premium landing page.
Product name: ${input.productName ?? ""}
Short description: ${input.shortDescription ?? ""}
Long description: ${input.longDescription ?? ""}
Price: ${input.price ?? ""}
Template: ${input.templateId ?? "minimal"}

Return JSON:
- For title: set value to a premium product title. Leave seoTitle and seoDescription as empty strings.
- For description: set value to a polished product description. Leave seoTitle and seoDescription as empty strings.
- For cta: set value to a short action CTA. Leave seoTitle and seoDescription as empty strings.
- For seo: set seoTitle and seoDescription. Leave value as an empty string.`
        }
      ]
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = responseSchema.parse(JSON.parse(content));

    try {
      await supabase.from("generations").insert({
        credits_used: 1,
        kind: `field_${input.field}`,
        output: parsed,
        prompt: input,
        user_id: user.id
      });
    } catch {
      // Generation should still succeed if usage tracking is not migrated yet.
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate field";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
