import type { Metadata } from "next";
import HomeClient from "@/app/components/public/HomeClient";

export const metadata: Metadata = {
  title: "AutoRent: automobilių nuoma internetu visoje Lietuvoje",
  description:
    "Peržiūrėk AutoRent automobilių parką internetu be registracijos. Palygink kainas pagal kuro tipą ir kėbulo klasę, atsiimk viename iš 10 miestų Lietuvoje.",
};

export default function Home() {
  return <HomeClient />;
}
