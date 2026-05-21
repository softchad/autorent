"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setToken } from "@/store/authSlice";

export default function AuthHydrate() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Po puslapio perkrovimo atkuria tokeną iš localStorage arba cookie
    const fromStorage = localStorage.getItem("token");
    const fromCookie = document.cookie.match(/(^| )token=([^;]+)/)?.[2] ?? null;
    const t = fromStorage ?? fromCookie;
    if (t) dispatch(setToken(t));
  }, []);

  return null;
}
