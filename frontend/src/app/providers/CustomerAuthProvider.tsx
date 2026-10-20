"use client";

import { createContext, useCallback, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { extractErrorMessage } from "@/utils/extractErrorMessage";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STORAGE_KEY = "customer_token";

export type CustomerInfo = {
  kliento_id: number;
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data: string | null;
};

type RegisterPayload = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  slaptazodis: string;
};

export type ProfileUpdatePayload = Partial<{
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
}>;

type CustomerAuthContextValue = {
  customer: CustomerInfo | null;
  token: string | null;
  isLoading: boolean;
  login: (elPastas: string, slaptazodis: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  applyTokenFromOAuth: (token: string) => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function storeToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// Grąžina kliento duomenis pagal tokeną, arba null, jei tokenas negalioja/pasibaigęs - kviečiantys (login/register/applyTokenFromOAuth) NIEKADA neturi tylėti, kai čia gaunamas null (žr. jų pačių komentarus, kodėl).
async function fetchCustomerInfo(token: string): Promise<CustomerInfo | null> {
  const res = await fetch(`${API}/api/v1/customer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Atskira kliento sesijos būsena, nesusieta su darbuotojų Redux authSlice - kitas localStorage raktas ("customer_token" vs "token"), kitas backend endpointas (/customer/...), kitas JWT tipas.
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  // Bandymo numeris neleidžia pavėluotam prisijungimo atsakymui pakeisti naujesnės paskyros ar atšaukti atsijungimo.
  const generation = useRef(0);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Atkuria kliento sesiją PO puslapio perkrovimo - jei localStorage turi tokeną, patikrina jį serveryje (ne tik pasitiki, kad jis tebegalioja); jei serveris jo nepriima, tokenas ištrinamas, kad kitą kartą vėl nebūtų bandomas tas pats negaliojantis.
  useEffect(() => {
    if (generation.current !== 0) { setIsLoading(false); return; }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    const attempt = generation.current;
    let active = true;
    fetchCustomerInfo(stored)
      .then((info) => {
        if (!active || attempt !== generation.current) return;
        if (info) {
          setCustomer(info);
          setTokenState(stored);
        } else {
          clearToken();
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  // Meta klaidą, jei tokenas negalioja (fetchCustomerInfo grąžina null) - be šito CustomerOAuthClient.tsx TYLIAI nukreiptų į /paskyra NEprisijungusį vartotoją, nes "await" sėkmingai pasibaigtų, net jei "info" liktų null.
  const applyTokenFromOAuth = useCallback(async (newToken: string) => {
    const attempt = ++generation.current;
    const info = await fetchCustomerInfo(newToken);
    if (attempt !== generation.current) throw new Error("Prisijungimo bandymas pakeistas.");
    if (!info) {
      clearToken();
      throw new Error("Tokenas negalioja arba pasibaigė");
    }
    setCustomer(info);
    storeToken(newToken);
    setTokenState(newToken);
  }, []);

  // "extractErrorMessage", NE fiksuotas tekstas - /customer/login turi IR @limiter.limit("5/minute") apsaugą, tad klaida gali būti NE TIK "neteisingi duomenys" (401), bet ir "per daug bandymų" (429, backend grąžina slowapi savo limito tekstą); fiksuotas "neteisingas el. paštas" tokiu atveju MELUOTŲ vartotojui, kuris iš tiesų žino savo tikrą slaptažodį.
  const login = useCallback(async (elPastas: string, slaptazodis: string) => {
    const attempt = ++generation.current;
    const res = await fetch(`${API}/api/v1/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ el_pastas: elPastas, slaptazodis }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(body, "Neteisingas el. paštas arba slaptažodis"));
    }
    const data = await res.json();
    const info = await fetchCustomerInfo(data.access_token);
    // "info === null" reikštų, kad serveris JUST IŠDAVĖ tokeną, bet IŠ KARTO jo nepriėmė (pvz. tinklo klaida antroje užklausoje) - be šios patikros modalas užsidarytų taip, lyg prisijungimas pavyko, nors "customer"/"token" realiai niekada nebūtų nustatyti.
    if (attempt !== generation.current) throw new Error("Prisijungimo bandymas pakeistas.");
    if (!info) {
      clearToken();
      throw new Error("Nepavyko prisijungti. Pabandykite vėliau.");
    }
    setCustomer(info);
    storeToken(data.access_token);
    setTokenState(data.access_token);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const attempt = ++generation.current;
    const res = await fetch(`${API}/api/v1/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(body, "Nepavyko užsiregistruoti"));
    }
    const data = await res.json();
    const info = await fetchCustomerInfo(data.access_token);
    // Žr. login() aukščiau dėl TOS PAČIOS apsaugos - be jos SignInModal.tsx užsidarytų taip, lyg registracija pavyko, nors paskyra realiai neprisijungta.
    if (attempt !== generation.current) throw new Error("Prisijungimo bandymas pakeistas.");
    if (!info) {
      clearToken();
      throw new Error("Paskyra sukurta, bet nepavyko prisijungti. Pabandykite prisijungti iš naujo.");
    }
    setCustomer(info);
    storeToken(data.access_token);
    setTokenState(data.access_token);
  }, []);

  // Profilio pakeitimas gali grąžinti naują prisijungimo bilietą: serveris pakeičia jo versiją po svarbių paskyros pakeitimų, o kliento ID išlieka tas pats.
  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    if (!token) throw new Error("Reikia prisijungti");
    const attempt = generation.current;
    const res = await fetch(`${API}/api/v1/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(body, "Nepavyko atnaujinti profilio"));
    }
    const data = await res.json();
    if (attempt !== generation.current) return;
    const { access_token, ...info } = data;
    setCustomer(info);
    if (access_token) {
      storeToken(access_token);
      setTokenState(access_token);
    }
  }, [token]);

  // Atsijungimas išvalo naršyklės bilietą ir padidina vietinio bandymo numerį, kad pavėluotas atsakymas nebegalėtų grąžinti paskyros į ekraną.
  const logout = useCallback(() => {
    generation.current++;
    clearToken();
    setCustomer(null);
    setTokenState(null);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ customer, token, isLoading, login, register, logout, applyTokenFromOAuth, updateProfile }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

// Patogus prieigos būdas prie CustomerAuthContext - meta AIŠKIĄ klaidą, jei komponentas kviečiamas ne CustomerAuthProvider viduje, vietoj TYLAUS "undefined" naudojimo, kurį supainiotų su tikrai neprisijungusiu klientu.
export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
