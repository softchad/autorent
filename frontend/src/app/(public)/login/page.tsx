"use client";

import { setToken } from "@/store/authSlice";
import { useLoginMutation } from "@/store/autorentApi";
import { useAppDispatch } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import logo from "@/assets/logo-mark.png";
import { formatApiError } from "@/utils/formatApiError";

const BACKEND = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  not_staff: "Ši paskyra nesusieta su darbuotojo profiliu. Kreipkitės į administratorių, jei turėtumėte turėti prieigą.",
  no_token: "Nepavyko prisijungti. Bandykite dar kartą.",
};

// Darbuotojų prisijungimo puslapis - el. paštas/slaptažodis ARBA Google/GitHub OAuth (nuorodos į BACKEND žemiau). Sėkmingas OAuth NIEKADA nenukreipia čia su tokenu (žr. useEffect komentarą žemiau) - tik su klaida.
export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Backend po SĖKMINGO OAuth prisijungimo nukreipia į /oauth (žr. OAuthClient.tsx, kuris VIENAS atlieka tokeno išskyrimą iš URL) - į ŠĮ puslapį grąžinama TIK su "?error=...", kai OAuth nepavyko (pvz. paskyra nesusieta su darbuotoju).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const err = sp.get("error");
    if (err) setOauthError(OAUTH_ERROR_MESSAGES[err] ?? OAUTH_ERROR_MESSAGES.no_token);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [login, { isLoading, isError, error }] = useLoginMutation();

  // Tikra klaida (neteisingas el. paštas/slaptažodis) rodoma per "isError" iš useLoginMutation aukščiau - "catch {}" čia tik sulaiko unwrap() išmestą klaidą, kad ji NEpasiektų konsolės kaip "unhandled", UI apie nepavykimą jau praneša kitu keliu.
  const handleLogin = async () => {
    if (isLoading) return;
    try {
      const res = await login({
        loginRequest: { el_pastas: email, slaptazodis: password },
      }).unwrap();
      dispatch(setToken(res.access_token));
      router.push("/dashboard");
    } catch {}
  };

  // Leidžia patvirtinti prisijungimą klaviatūros "Enter" klavišu, ne tik paspaudus mygtuką pele.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-[#0E0B1F] flex items-center justify-center px-4">
      {/* Fono debesiukai */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#0F597B]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#0F597B]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Kortelė */}
        <div className="bg-[#0E1525]/90 backdrop-blur border border-[#1C2B3A] rounded-2xl shadow-2xl px-8 py-10">

          {/* Logotipas */}
          <div className="flex justify-center mb-8">
            <Image src={logo} alt="AutoRent" width={160} height={48} className="object-contain" />
          </div>

          <h2 className="text-[#F7F7F7] text-xl font-semibold text-center mb-1">Sveiki sugrįžę</h2>
          <p className="text-[#707070] text-sm text-center mb-8">Prisijunkite prie AutoRent sistemos</p>

          {/* Laukai */}
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
                >
                  {showPass ? "Slėpti" : "Rodyti"}
                </button>
              </div>
            </div>
          </div>

          {/* Klaida */}
          {isError && (
            <p className="text-red-400 text-xs mt-3 text-center">
              {formatApiError(error, "Nepavyko prisijungti. Patikrinkite ryšį ir bandykite dar kartą.")}
            </p>
          )}
          {oauthError && (
            <p className="text-red-400 text-xs mt-3 text-center">{oauthError}</p>
          )}

          {/* Pateikimo mygtukas */}
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

          {/* OAuth skirtukas */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1C2B3A]" />
            <span className="text-[#3D4F63] text-xs">arba</span>
            <div className="flex-1 h-px bg-[#1C2B3A]" />
          </div>

          {/* OAuth mygtukai */}
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

          {/* Poraštė */}
          <p className="text-[#3D4F63] text-xs text-center mt-6">
            AutoRent © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
