import type { Metadata } from "next";
import { Suspense } from "react";
import AccountClient from "@/app/components/public/AccountClient";

// Next.js metaduomenys eksportuojami šiame serverio puslapyje, o interaktyvus profilis, rezervacijos ir pokalbiai perduodami AccountClient komponentui su use client.

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Mano paskyra: AutoRent",
  description: "AutoRent kliento paskyros profilis ir nuomų informacija.",
};

// AccountClient skaito URL parametrus per useSearchParams() - Next.js REIKALAUJA, kad toks komponentas būtų apgaubtas <Suspense>, kitaip "next build" meta klaidą; fallback={null}, nes šaknyje jau yra bendras loading.tsx.
export default function PaskyraPage() {
  return (
    <Suspense fallback={null}>
      <AccountClient />
    </Suspense>
  );
}
