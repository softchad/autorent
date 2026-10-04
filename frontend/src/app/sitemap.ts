import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Tik statiniai vieši puslapiai - žr. @/utils/publicRoutes PUBLIC_ROUTES.
// /paskyra praleista: tai prisijungusio kliento paskyra, ne turinys indeksavimui.
const STATIC_PUBLIC_PAGES = [
  "/",
  "/apie-mus",
  "/automobiliai",
  "/karjera",
  "/kelioniu-patarimai",
  "/kontaktai",
  "/nuomos-taisykles",
  "/privatumo-politika",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PUBLIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
