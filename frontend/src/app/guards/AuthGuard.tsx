"use client";
import { setToken } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useRef } from "react";

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
      pathname === "/login" ||
      pathname.startsWith("/oauth") ||     // svarbu!
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname === "/favicon.ico"
    );
  }, [pathname]);

  // Vienkartinė hidracija iš cookie/LS
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current && !token) {
      hydrated.current = true;
      const fromCookie = readCookie("token");
      const fromLS = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const t = fromCookie || fromLS;
      if (t) dispatch(setToken(t));
    }
  }, [token, dispatch]);

  // Nukreipimai
  useEffect(() => {
    if (!pathname) return;

    // jei prisijungęs ir bando eiti į /login – nukreipti į /
    if (token && pathname === "/login") {
      router.replace("/");
      return;
    }

    // jei public – nieko nedarom (leidžiam /oauth suveikti)
    if (isPublic) return;

    // jei ne public ir nėra tokeno – į login
    if (!token) {
      router.replace("/login");
    }
  }, [token, pathname, isPublic, router]);

  // Kol dar neturim tokeno ir kelias ne public – nerenderinam
  if (!token && !isPublic) return null;

  return <>{children}</>;
}
