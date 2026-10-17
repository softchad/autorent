import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Specialus Next.js failo pavadinimas (robots.ts) - sistema PATI, be papildomo nustatymo, jį paverčia į /robots.txt, kurį paieškos sistemų robotai skaito PRIEŠ indeksuodami svetainę. "disallow" sąrašo įrašai veikia kaip PRIEŠDĖLIAI (pvz. "/paskyra" apima IR "/paskyra/oauth"), tad kiekvieno pokelio nereikia įrašyti atskirai.
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
