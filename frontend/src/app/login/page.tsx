"use client";

import { setToken } from "@/store/authSlice";
import { useLoginMutation } from "@/store/carRentalApi";
import { useAppDispatch } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
const logo = require("@/assets/autorentLOGO.png");

const BACKEND = "http://localhost:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let t = sp.get("token");
    if (!t) {
      const h = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      t = new URLSearchParams(h).get("access_token");
    }
    if (!t) return;
    dispatch(setToken(t));
    document.cookie = `token=${t}; path=/; SameSite=Lax`;
    router.replace("/");
  }, [dispatch, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [login, { isLoading, isError }] = useLoginMutation();

  const handleLogin = async () => {
    try {
      const res = await login({
        loginRequest: { el_pastas: email, slaptazodis: password },
      }).unwrap();
      dispatch(setToken(res.access_token));
      document.cookie = `token=${res.access_token}; path=/;`;
      router.push("/");
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-[#0E0B1F] flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#0F597B]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#0F597B]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#0E1525]/90 backdrop-blur border border-[#1C2B3A] rounded-2xl shadow-2xl px-8 py-10">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image src={logo} alt="AutoRent" width={160} height={48} className="object-contain" />
          </div>

          <h2 className="text-[#F7F7F7] text-xl font-semibold text-center mb-1">Sveiki sugrįžę</h2>
          <p className="text-[#707070] text-sm text-center mb-8">Prisijunkite prie AutoRent sistemos</p>

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#707070] mb-1.5 font-medium">El. paštas</label>
              <input
                type="email"
                placeholder="vardas@autorent.lt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F597B] focus:ring-1 focus:ring-[#0F597B]/50 transition"
              />
            </div>

            <div>
              <label className="block text-xs text-[#707070] mb-1.5 font-medium">Slaptažodis</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F597B] focus:ring-1 focus:ring-[#0F597B]/50 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3D4F63] hover:text-[#707070] text-xs transition"
                  tabIndex={-1}
                >
                  {showPass ? "Slėpti" : "Rodyti"}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {isError && (
            <p className="text-red-400 text-xs mt-3 text-center">
              Neteisingas el. paštas arba slaptažodis
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={isLoading || !email || !password}
            className="mt-6 w-full bg-[#0F597B] hover:bg-[#0C4A66] disabled:opacity-40 disabled:cursor-not-allowed text-[#F7F7F7] font-semibold py-2.5 rounded-lg transition text-sm tracking-wide"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Jungiamasi...
              </span>
            ) : "Prisijungti"}
          </button>

          {/* OAuth divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1C2B3A]" />
            <span className="text-[#3D4F63] text-xs">arba</span>
            <div className="flex-1 h-px bg-[#1C2B3A]" />
          </div>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { window.location.href = `${BACKEND}/google/login`; }}
              className="w-full flex items-center justify-center gap-3 bg-[#1A2238] hover:bg-[#1E2A47] border border-[#1C2B3A] hover:border-[#0F597B]/40 text-[#F7F7F7] text-sm font-medium py-2.5 rounded-lg transition"
            >
              <FcGoogle size={18} />
              Prisijungti su Google
            </button>
            <button
              onClick={() => { window.location.href = `${BACKEND}/github/login`; }}
              className="w-full flex items-center justify-center gap-3 bg-[#1A2238] hover:bg-[#1E2A47] border border-[#1C2B3A] hover:border-[#0F597B]/40 text-[#F7F7F7] text-sm font-medium py-2.5 rounded-lg transition"
            >
              <FaGithub size={18} />
              Prisijungti su GitHub
            </button>
          </div>

          {/* Footer */}
          <p className="text-[#3D4F63] text-xs text-center mt-6">
            AutoRent © {new Date().getFullYear()} · Vidinė sistema
          </p>
        </div>
      </div>
    </div>
  );
}
