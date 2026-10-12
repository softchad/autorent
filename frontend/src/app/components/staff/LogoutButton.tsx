"use client";

import { logout as logoutAction } from "@/store/authSlice";
import { baseApi } from "@/store/baseApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";
import { deleteCookie } from "@/utils/cookie";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Darbuotojo atsijungimo mygtukas - RODOMAS TIK kai yra token'as (žr. "if (!token) return null" žemiau); client pusės duomenys ištrinami NEPRIKLAUSOMAI nuo backend kvietimo sėkmės, kad vartotojas visada liktų "atsijungęs" iš savo naršyklės perspektyvos, net jei tinklo užklausa nepavyktų.
export default function LogoutButton() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const [loading, setLoading] = useState(false);

  if (!token) return null;

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/v1/logout`, { method: "POST", credentials: "include" }).catch(() => {});
      // "logoutAction()" (žr. authSlice.ts "logout" reducer'į) JAU pats nustato token=null, IR ištrina jį iš localStorage, IR ištrina "token" slapuką - čia reikia papildomai tik "session" (Starlette SessionMiddleware, naudotas trumpam per OAuth srautą), kurio authSlice.ts nežino, nes jis nesusijęs su staff tokenu.
      dispatch(logoutAction());
      dispatch(baseApi.util.resetApiState());
      deleteCookie("session");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#8899AA] hover:bg-[#5B1E2A]/30 hover:text-red-400 transition-all disabled:opacity-50 group"
    >
      <FiLogOut className="text-base shrink-0 text-[#3D4F63] group-hover:text-red-400 transition-colors" />
      {loading ? "Atsijungiama..." : "Atsijungti"}
    </button>
  );
}
