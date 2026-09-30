import type { Metadata } from "next";
import { Suspense } from "react";
import AutomobiliaiClient from "@/app/components/public/AutomobiliaiClient";

export const metadata: Metadata = {
  title: "Automobiliai: AutoRent",
  description: "Naršyk visą AutoRent automobilių parką, filtruok pagal markę, kainą, kėbulo tipą ir vietą.",
};

export default function AutomobiliaiPage() {
  return (
    <Suspense fallback={null}>
      <AutomobiliaiClient />
    </Suspense>
  );
}
