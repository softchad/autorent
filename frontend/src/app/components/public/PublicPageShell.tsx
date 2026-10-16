"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import MapTexture from "./MapTexture";
import { SearchValue } from "./SearchForm";
import { buildAutomobiliaiHref } from "@/utils/publicSearch";
import { defaultDateRange } from "@/utils/formatLt";

// Bendras karkasas paprastiems viešiems puslapiams (apie-mus, karjera, kontaktai ir pan.) - header/footer/fonas identiški kitiems viešo puslapio komponentams, bet PATYS "children" neturi žinoti nei apie paieškos būseną, nei apie MapTexture/PublicHeader/PublicFooter sudėjimą.
export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchValue>({ location: "", ...defaultDateRange() });

  return (
    // Be overflow-x-hidden ČIA - tai laužia PublicHeader "sticky" pozicionavimą (CSS elgesys: overflow-x nustatymas protėvyje sukuria naują scroll konteinerį, kuriame sticky elementas "prilimpa" tik PRIE JO, o ne prie realaus naršyklės lango); horizontalus persiliejimas jau apsaugotas lokaliai - MapTexture žemiau turi savo overflow-hidden.
    <div className="relative min-h-screen bg-[#0B121F]">
      <MapTexture />
      <div className="relative z-10">
        <PublicHeader
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={() => router.push(buildAutomobiliaiHref(search))}
        />
        <main>{children}</main>
        <PublicFooter />
      </div>
    </div>
  );
}
