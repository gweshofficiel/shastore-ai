import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import type { AiLandingCopy } from "@/types/landing";

const copyRequestSchema = z.object({
  productName: z.string().min(2),
  productPrice: z.string().min(1),
  productDescription: z.string().min(10),
  whatsappNumber: z.string().min(7),
  brandColor: z.string().min(4),
  templateId: z.string().optional(),
  tone: z.string().optional()
});

const aiCopySchema = z.object({
  productTitle: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  description: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  benefits: z.array(z.string()).min(3),
  features: z.array(z.object({ title: z.string(), description: z.string() })),
  testimonials: z.array(z.object({ quote: z.string(), author: z.string() })),
  pricing: z.object({
    label: z.string(),
    price: z.string(),
    note: z.string()
  }),
  sections: z.array(
    z.object({
      eyebrow: z.string(),
      title: z.string(),
      body: z.string()
    })
  ),
  ctaText: z.string(),
  ctaBlock: z.object({
    title: z.string(),
    body: z.string()
  }),
  faq: z.array(z.object({ question: z.string(), answer: z.string() }))
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const product = copyRequestSchema.parse(body);
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "landing_copy_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              productTitle: { type: "string" },
              headline: { type: "string" },
              subheadline: { type: "string" },
              description: { type: "string" },
              seoTitle: { type: "string" },
              seoDescription: { type: "string" },
              benefits: {
                type: "array",
                items: { type: "string" }
              },
              features: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" }
                  },
                  required: ["title", "description"]
                }
              },
              testimonials: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    quote: { type: "string" },
                    author: { type: "string" }
                  },
                  required: ["quote", "author"]
                }
              },
              pricing: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  price: { type: "string" },
                  note: { type: "string" }
                },
                required: ["label", "price", "note"]
              },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    eyebrow: { type: "string" },
                    title: { type: "string" },
                    body: { type: "string" }
                  },
                  required: ["eyebrow", "title", "body"]
                }
              },
              ctaText: { type: "string" },
              ctaBlock: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  body: { type: "string" }
                },
                required: ["title", "body"]
              },
              faq: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" }
                  },
                  required: ["question", "answer"]
                }
              }
            },
            required: [
              "productTitle",
              "headline",
              "subheadline",
              "description",
              "seoTitle",
              "seoDescription",
              "benefits",
              "features",
              "testimonials",
              "pricing",
              "sections",
              "ctaText",
              "ctaBlock",
              "faq"
            ]
          }
        }
      },
      messages: [
        {
          role: "system",
          content:
            "You write concise ecommerce landing page copy. Return structured JSON only, with no markdown."
        },
        {
          role: "user",
          content: `Create landing page copy for this product:
Name: ${product.productName}
Price: ${product.productPrice}
Description: ${product.productDescription}
WhatsApp CTA number: ${product.whatsappNumber}
Brand color: ${product.brandColor}
Template style: ${product.templateId ?? "minimal"}
Tone: ${product.tone ?? "premium, simple, conversion-focused"}

Return valid JSON with exactly these keys:
productTitle: string
headline: string
subheadline: string
description: string
seoTitle: string under 60 characters
seoDescription: string under 155 characters
benefits: array of 4 short strings
features: array of 4 objects with title and description
testimonials: array of 2 realistic objects with quote and author
pricing: object with label, price, note
sections: array of 3 objects with eyebrow, title, body
ctaText: string
ctaBlock: object with title and body
faq: array of 4 objects with question and answer strings`
        }
      ]
    });

    const text = completion.choices[0]?.message.content ?? "{}";
    const copy = aiCopySchema.parse(JSON.parse(text)) as AiLandingCopy;

    try {
      const supabase = await createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("generations").insert({
          user_id: user.id,
          kind: "landing_copy",
          prompt: product,
          output: copy,
          credits_used: 1
        });
      }
    } catch {
      // Generation should still succeed if usage tracking is not migrated yet.
    }

    return NextResponse.json(copy);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate copy";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
