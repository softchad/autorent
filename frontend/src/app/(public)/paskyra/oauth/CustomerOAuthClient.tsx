"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";

// Perima tokeną iš URL hash fragmento (backend VISADA nukreipia čia su "#access_token=...") ir perduoda jį CustomerAuthProvider'iui - hash (ne "?token=" query param) naudojamas SĄMONINGAI, kad naršyklė tokeno NEsiųstų serveriui/prieigos žurnalams.
export default function CustomerOAuthClient() {
  const router = useRouter();
  const { applyTokenFromOAuth } = useCustomerAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const token = new URLSearchParams(hash).get("access_token");
    if (!token) {
      setError(true);
      return;
    }
    // ".catch" BŪTINAS - applyTokenFromOAuth meta klaidą, jei tokenas negalioja (žr. CustomerAuthProvider.tsx); be šito vartotojas būtų TYLIAI nukreiptas į /paskyra NEprisijungęs, be jokio paaiškinimo.
    applyTokenFromOAuth(token)
      .then(() => {
        const returnTo = sessionStorage.getItem("customer_return_path");
        sessionStorage.removeItem("customer_return_path");
        router.replace(returnTo && /^\/automobiliai\/[1-9]\d*(?:\?[^#]*)?$/.test(returnTo) ? returnTo : "/paskyra");
      })
      .catch(() => setError(true));
  }, [applyTokenFromOAuth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B121F] px-4">
      <p className="text-sm text-[#8899AA]">
        {error ? (
          <>
            Nepavyko prisijungti. Grįžkite į{" "}
            <Link href="/" className="text-[#4BAFD4] hover:underline">
              pradinį puslapį
            </Link>{" "}
            ir bandykite dar kartą.
          </>
        ) : (
          "Jungiamasi..."
        )}
      </p>
    </div>
  );
}
