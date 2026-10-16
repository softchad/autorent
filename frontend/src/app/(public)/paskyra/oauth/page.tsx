import { Suspense } from "react";
import CustomerOAuthClient from "./CustomerOAuthClient";

// Logika ATSKIRTA į CustomerOAuthClient.tsx ("use client"), nes "dynamic"/"fetchCache" žemiau Next.js tyliai IGNORUOJA, jei juos eksportuotų "use client" failas (patikrinta tapačiame /oauth/page.tsx kelyje - sulietas variantas sukompiliuoja, bet puslapis tampa statiniu, be klaidos pranešimo).
// "dynamic"/"fetchCache" - neleidžia šio puslapio statiškai sugeneruoti ar cache'uoti, nes kiekvienas apsilankymas skirtas VIENAM konkrečiam OAuth grąžinimui.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// CustomerOAuthClient NEnaudoja useSearchParams() (skirtingai nuo AccountClient.tsx) - <Suspense> čia tik dėl vienodos struktūros su kitais OAuth grąžinimo puslapiais, ne Next.js reikalavimas.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerOAuthClient />
    </Suspense>
  );
}
