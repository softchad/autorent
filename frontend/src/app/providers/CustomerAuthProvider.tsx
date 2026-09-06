"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

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
  bonus_taskai: number;
};

type RegisterPayload = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  slaptazodis: string;
};

type CustomerAuthContextValue = {
  customer: CustomerInfo | null;
  token: string | null;
  isLoading: boolean;
  login: (elPastas: string, slaptazodis: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  applyTokenFromOAuth: (token: string) => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function storeToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
  document.cookie = `${STORAGE_KEY}=${token}; path=/; SameSite=Lax`;
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${STORAGE_KEY}=; path=/; Max-Age=0`;
}

async function fetchCustomerInfo(token: string): Promise<CustomerInfo | null> {
  const res = await fetch(`${API}/api/v1/customer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Atskira kliento sesijos būsena, nesusieta su darbuotojų Redux authSlice - kitas
// localStorage/cookie raktas ("customer_token" vs "token"), kitas backend
// endpointas (/customer/...), kitas JWT tipas. Žr. backend app/api/deps.py
// get_current_customer komentarus dėl saugumo ribos tarp šių dviejų sistemų.
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    fetchCustomerInfo(stored)
      .then((info) => {
        if (info) {
          setCustomer(info);
          setTokenState(stored);
        } else {
          clearToken();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const applyTokenFromOAuth = useCallback(async (newToken: string) => {
    storeToken(newToken);
    const info = await fetchCustomerInfo(newToken);
    if (info) {
      setCustomer(info);
      setTokenState(newToken);
    }
  }, []);

  const login = useCallback(async (elPastas: string, slaptazodis: string) => {
    const res = await fetch(`${API}/api/v1/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ el_pastas: elPastas, slaptazodis }),
    });
    if (!res.ok) throw new Error("Neteisingas el. paštas arba slaptažodis");
    const data = await res.json();
    storeToken(data.access_token);
    const info = await fetchCustomerInfo(data.access_token);
    if (info) {
      setCustomer(info);
      setTokenState(data.access_token);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await fetch(`${API}/api/v1/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail ?? "Nepavyko užsiregistruoti");
    }
    const data = await res.json();
    storeToken(data.access_token);
    const info = await fetchCustomerInfo(data.access_token);
    if (info) {
      setCustomer(info);
      setTokenState(data.access_token);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setCustomer(null);
    setTokenState(null);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ customer, token, isLoading, login, register, logout, applyTokenFromOAuth }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
