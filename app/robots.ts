import type { MetadataRoute } from "next";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://shastore.ai";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ["/", "/l/", "/store/"],
      disallow: ["/admin/", "/dashboard/", "/api/"],
      userAgent: "*"
    },
    sitemap: `${siteUrl()}/sitemap.xml`
  };
}
