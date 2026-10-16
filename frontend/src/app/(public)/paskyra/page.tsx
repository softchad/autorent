import type { Metadata } from "next";
import { Suspense } from "react";
import AccountClient from "@/app/components/public/AccountClient";

// Logika ATSKIRTA į AccountClient.tsx ("use client"), nes "metadata" eksportas žemiau Next.js VISIŠKAI UŽDRAUDŽIA "use client" faile - skirtingai nuo "dynamic"/"fetchCache" (žr. /oauth/page.tsx, kur tai tyliai ignoruojama), su "metadata" tai iškart sulaužytų "npm run build" (patikrinta - tiksli klaida: "You are attempting to export 'metadata' from a component marked with 'use client', which is disallowed").

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
