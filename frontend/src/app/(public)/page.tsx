import type { Metadata } from "next";
import HomeClient from "@/app/components/public/HomeClient";

// Specialus Next.js eksportas (metadata) - sistema PATI sudeda šiuos laukus į <head> (title/description), skaito IR paieškos sistemos, IR nuorodos peržiūra soc. tinkluose.
export const metadata: Metadata = {
  title: "AutoRent: automobilių nuoma internetu visoje Lietuvoje",
  description:
    "Peržiūrėk AutoRent automobilių parką internetu be registracijos. Palygink kainas pagal kuro tipą ir kėbulo klasę, atsiimk viename iš 10 miestų Lietuvoje.",
};

// Homepage'o TURINYS gyvena HomeClient.tsx ("use client", nes naudoja hooks/interaktyvumą) - ŠIS failas lieka server component'as TIK tam, kad metadata eksportas aukščiau veiktų (metadata negalima eksportuoti iš "use client" failo).
export default function Home() {
  return <HomeClient />;
}
