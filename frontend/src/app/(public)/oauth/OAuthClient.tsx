"use client";

import { setToken } from "@/store/authSlice";
import { useAppDispatch } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Vienintelis šio puslapio tikslas - perimti tokeną iš URL HASH fragmento (backend VISADA nukreipia čia su "#access_token=...", žr. auth.py) ir perduoti jį toliau. Hash (ne "?token=" query param) naudojamas SĄMONINGAI - naršyklė hash dalies NESIUNČIA serveriui, tad tokenas nepatenka į serverio prieigos žurnalus.
export default function OAuthClient() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const token = new URLSearchParams(hash).get("access_token");

    if (!token) {
      router.replace("/login?error=no_token");
      return;
    }

    dispatch(setToken(token));
    router.replace("/dashboard");
  }, [dispatch, router]);

  return null;
}
