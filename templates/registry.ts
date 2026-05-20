import type { LandingTemplate } from "@/types/landing";
import { supportedPlaceholders } from "@/templates/engine";

export const templatePlaceholders = [...supportedPlaceholders];

export const landingTemplates: LandingTemplate[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean Apple-style product page with crisp sections.",
    category: "Clean commerce",
    previewImage: "linear-gradient(135deg,#ffffff,#e2e8f0)",
    colorPalette: ["#ffffff", "#0f172a", "#e2e8f0"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Premium products", "Digital offers", "Single product shops"],
    placeholders: templatePlaceholders
  },
  {
    id: "luxury",
    name: "Luxury",
    description: "Warm editorial layout for premium products and offers.",
    category: "Premium editorial",
    previewImage: "linear-gradient(135deg,#f8f5ef,#92400e)",
    colorPalette: ["#f8f5ef", "#1c1917", "#b45309"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Jewelry", "Perfume", "High-ticket gifts"],
    placeholders: templatePlaceholders
  },
  {
    id: "beauty",
    name: "Beauty",
    description: "Soft, premium layout for cosmetics, skincare, and wellness.",
    category: "Beauty and wellness",
    previewImage: "linear-gradient(135deg,#fff7f7,#fb7185)",
    colorPalette: ["#fff7f7", "#fb7185", "#881337"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Skincare", "Cosmetics", "Wellness"],
    placeholders: templatePlaceholders
  },
  {
    id: "gadget",
    name: "Gadget",
    description: "Crisp, technical layout for electronics and useful devices.",
    category: "Tech commerce",
    previewImage: "linear-gradient(135deg,#020617,#38bdf8)",
    colorPalette: ["#020617", "#38bdf8", "#e2e8f0"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Electronics", "Smart devices", "Accessories"],
    placeholders: templatePlaceholders
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Elegant brand-forward template for fashion and accessories.",
    category: "Fashion brand",
    previewImage: "linear-gradient(135deg,#fbfaf7,#18181b)",
    colorPalette: ["#fbfaf7", "#18181b", "#a1a1aa"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Apparel", "Accessories", "Boutiques"],
    placeholders: templatePlaceholders
  },
  {
    id: "saas",
    name: "SaaS",
    description: "Conversion-focused landing page for software and digital offers.",
    category: "Digital product",
    previewImage: "linear-gradient(135deg,#eff6ff,#2563eb)",
    colorPalette: ["#eff6ff", "#2563eb", "#0f172a"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Software", "Digital downloads", "Online services"],
    placeholders: templatePlaceholders
  },
  {
    id: "local-business",
    name: "Local Business",
    description: "Trust-led template for services, shops, and local offers.",
    category: "Local services",
    previewImage: "linear-gradient(135deg,#fff7ed,#f97316)",
    colorPalette: ["#fff7ed", "#f97316", "#431407"],
    mobileOptimized: true,
    conversionOptimized: true,
    recommendedNiches: ["Restaurants", "Clinics", "Local services"],
    placeholders: templatePlaceholders
  }
];

export function getTemplate(templateId: string) {
  return landingTemplates.find((template) => template.id === templateId);
}
