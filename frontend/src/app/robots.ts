import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Darbuotojų administravimo sritys ir kliento paskyra neturi būti indeksuojamos.
      disallow: [
        "/login",
        "/dashboard",
        "/fleet",
        "/clients",
        "/employees",
        "/orders",
        "/reservations",
        "/invoices",
        "/support",
        "/paskyra",
        "/oauth",
        "/profile",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
