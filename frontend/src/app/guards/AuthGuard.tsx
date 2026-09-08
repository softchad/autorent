"use client";
import { setToken } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { isPublicPath } from "@/utils/publicRoutes";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const token = useAppSelector(s => s.auth.token);

  // Leidžiami keliai be auth (WHITE-LIST)
  const isPublic = useMemo(() => {
    if (!pathname) return false;
    return (
      isPublicPath(pathname) ||
      pathname === "/login" ||
      pathname.startsWith("/oauth") ||     // svarbu!
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname === "/favicon.ico"
    );
  }, [pathname]);

  // Vienkartinė hidracija iš cookie/LS. Kol nepasibaigus – nukreipimų efektas
  // dar netikrina tokeno, kitaip po hard-reload (pvz. page.goto()/F5) jis
  // spėtų nukreipti į /login prieš spėjant nuskaityti cookie (žr. race'ą žemiau).
  const hydrated = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      if (!token) {
        const fromCookie = readCookie("token");
        const fromLS = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const t = fromCookie || fromLS;
        if (t) dispatch(setToken(t));
      }
    }
    setIsHydrating(false);
  }, [token, dispatch]);

  // Nukreipimai
  useEffect(() => {
    if (!pathname || isHydrating) return;

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
  }, [token, pathname, isPublic, router, isHydrating]);

  // Kol dar hidruojamės arba neturim tokeno ir kelias ne public – nerenderinam.
  // Public keliams hidracijos nelaukiam, kad nemirksėtų viešas turinys.
  if (!isPublic && (isHydrating || !token)) return null;

  return <>{children}</>;
}
