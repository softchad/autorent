import { Suspense } from "react";
import OAuthClient from "./OAuthClient";

// Next.js serverio puslapis nustato maršruto vykdymo režimą, o OAuthClient naršyklėje perskaito darbuotojo prisijungimo bilietą ir perduoda jį Redux autentifikacijos būsenai.

// force-dynamic nurodo Next.js negeneruoti iš anksto bendros šio prisijungimo puslapio HTML kopijos, o force-no-store išjungia puslapio serverinių fetch užklausų talpyklą.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Darbuotojo OAuth puslapis perduoda prisijungimo užbaigimą OAuthClient komponentui, o Suspense apibrėžia jo įkėlimo ribą.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <OAuthClient />
    </Suspense>
  );
}
