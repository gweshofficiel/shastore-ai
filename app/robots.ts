import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/deployment/config";

function siteUrl() {
  return getAppBaseUrl();
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ["/", "/l/", "/store/"],
      disallow: [
        "/admin/",
        "/api/",
        "/dashboard/",
        "/store/*/account",
        "/store/*/cart",
        "/store/*/compare",
        "/store/*/order/",
        "/store/*/receipt/",
        "/store/*/track",
        "/store/*/wishlist"
      ],
      userAgent: "*"
    },
    sitemap: `${siteUrl()}/sitemap.xml`
  };
}
