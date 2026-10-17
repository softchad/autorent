"use client";
import { setToken } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { isPublicPath } from "@/utils/publicRoutes";
import { readCookie } from "@/utils/cookie";
import { isUsableStaffToken } from "@/utils/jwt";

// Darbuotojų prisijungimo sargas - apgaubia VISĄ app/layout.tsx turinį (ir viešą, ir darbuotojų pusę), nukreipia NEprisijungusį darbuotoją į /login, kai jis bando pasiekti ne-viešą kelią, ir atvirkščiai, nukreipia JAU prisijungusį darbuotoją iš /login į /dashboard.
export default function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const token = useAppSelector(s => s.auth.token);

  // Keliai, kuriuose šis sargas NIEKADA nenukreipia į /login, net be tokeno - "/api" ČIA NĖRA, nes šis frontend'as savo /api kelių neturi (visos tikros API užklausos keliauja į ATSKIRĄ backend serverį, žr. NEXT_PUBLIC_API_URL), tad toks kelias šiame app'e niekada nerodomas.
  const isPublic = useMemo(() => {
    if (!pathname) return false;
    return (
      isPublicPath(pathname) ||
      pathname === "/login" ||
      // "/oauth" PRIVALO būti viešas - juo grįžta DAR NEprisijungęs darbuotojas iš Google; jei šis sargas jį čia nukreiptų į /login, OAuthClient.tsx niekada nespėtų išsitraukti tokeno iš URL ir prisijungimas per Google būtų visiškai sulaužytas.
      pathname.startsWith("/oauth") ||
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico"
    );
  }, [pathname]);

  // Vienkartinė hidracija iš slapuko/localStorage PO hard-reload (pvz. F5) - kol ji nesibaigė, žemiau esantis nukreipimų efektas dar NETIKRINA tokeno (žr. "isHydrating" jo sąlygoje), kitaip jis spėtų nukreipti į /login PRIEŠ šiam efektui spėjus perskaityti slapuką/localStorage ir atstatyti tokeną.
  const hydrated = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      if (!token) {
        const fromCookie = readCookie("token");
        const fromLS = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const t = fromCookie || fromLS;
        if (t) dispatch(setToken(isUsableStaffToken(t) ? t : null));
      }
    }
    setIsHydrating(false);
  }, [token, dispatch]);

  // Nukreipimai
  useEffect(() => {
    if (!pathname || isHydrating) return;
    if (token && !isUsableStaffToken(token)) {
      dispatch(setToken(null));
      return;
    }

    // jei prisijungęs ir bando eiti į /login – nukreipti į darbuotojų dashboard'ą
    if (token && pathname === "/login") {
      router.replace("/dashboard");
      return;
    }

    // jei public – nieko nedarom (leidžiam /oauth suveikti)
    if (isPublic) return;

    // jei ne public ir nėra tokeno – į login
    if (!token) {
      router.replace("/login");
    }
  }, [token, pathname, isPublic, router, isHydrating, dispatch]);

  // Kol dar hidruojamės arba neturim tokeno ir kelias NE public – nerenderinam nieko (apsauga nuo trumpo "blyksnio" su apsaugotu turiniu prieš nukreipimą); public keliams hidracijos nelaukiam, kad nemirksėtų viešas turinys net darbuotojų atveju.
  if (!isPublic && (isHydrating || !token)) return null;

  return <>{children}</>;
}
