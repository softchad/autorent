"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import MapTexture from "./MapTexture";
import { SearchValue } from "./SearchForm";
import { buildAutomobiliaiHref } from "@/utils/publicSearch";
import { defaultDateRange } from "@/utils/formatLt";

export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchValue>({ location: "", ...defaultDateRange() });

  return (
    // Be overflow-x-hidden - laužia PublicHeader "sticky" (žr. HomeClient.tsx komentarą).
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
