import { Suspense } from "react";
import CustomerOAuthClient from "./CustomerOAuthClient";

// Serverio puslapis nustato Next.js vykdymo režimą, o CustomerOAuthClient naršyklėje perduoda gautą bilietą CustomerAuthProvider ir atkuria patikrintą grįžimo kelią.
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
