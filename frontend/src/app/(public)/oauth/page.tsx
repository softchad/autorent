import { Suspense } from "react";
import OAuthClient from "./OAuthClient";

// Logika ATSKIRTA į OAuthClient.tsx ("use client"), nes "dynamic"/"fetchCache" žemiau Next.js tyliai IGNORUOJA, jei juos eksportuotų "use client" failas (patikrinta - sulietas variantas sukompiliuoja, bet puslapis tampa statiniu, be klaidos pranešimo).

// Specialūs Next.js eksportai - "dynamic" neleidžia šio puslapio statiškai sugeneruoti VIENĄ kartą kūrimo metu (patikrinta "npm run build" išvestyje - šis kelias pažymėtas "ƒ", ne "○"), "fetchCache" papildomai neleidžia jo cache'uoti CDN/naršyklės lygmenyje - apsauga nuo bet kokios sukauptos HTML kopijos, net jei pati OAuth logika (OAuthClient.tsx) ir taip veikia vien naršyklėje, po puslapio užkrovimo.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Tik perduoda į OAuthClient.tsx (visa logika TEN) - <Suspense> paliktas, net nebūtinas po to, kai OAuthClient nebenaudoja useSearchParams(), bet nekenkia, tad nekeista.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <OAuthClient />
    </Suspense>
  );
}
