import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";

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

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate field";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
