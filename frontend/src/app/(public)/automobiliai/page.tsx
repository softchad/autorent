import type { Metadata } from "next";
import { Suspense } from "react";
import AutomobiliaiClient from "@/app/components/public/AutomobiliaiClient";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Automobiliai: AutoRent",
  description: "Naršyk visą AutoRent automobilių parką, filtruok pagal markę, kainą, kėbulo tipą ir vietą.",
};

// AutomobiliaiClient skaito URL parametrus per useSearchParams() (pvz. ?location=...&dateFrom=...) - Next.js REIKALAUJA, kad toks komponentas būtų apgaubtas <Suspense>, kitaip "next build" meta klaidą; fallback={null}, nes šaknyje jau yra bendras loading.tsx, antro kraunamo indikatoriaus rodyti nereikia.
export default function AutomobiliaiPage() {
  return (
    <Suspense fallback={null}>
      <AutomobiliaiClient />
    </Suspense>
  );
}
