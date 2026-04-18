"use client";

import { logout as logoutAction, setToken } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/;`;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
      dispatch(logoutAction());
      dispatch(setToken(null as unknown as string));
      deleteCookie("token");
      deleteCookie("session");
      if (typeof localStorage !== "undefined") localStorage.removeItem("accessToken");
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
