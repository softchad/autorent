"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiX, FiBriefcase } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import logo from "@/assets/autorentLOGO.png";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Mode = "login" | "register";

export default function SignInModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { customer, login, register, logout } = useCustomerAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [vardas, setVardas] = useState("");
  const [pavarde, setPavarde] = useState("");
  const [elPastas, setElPastas] = useState("");
  const [telefonoNr, setTelefonoNr] = useState("");
  const [gimimoData, setGimimoData] = useState("");
  const [slaptazodis, setSlaptazodis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Kiekvieną kartą atidarius modalą iš naujo, žinutė ir laukai neturėtų likę iš praeito karto.
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(elPastas, slaptazodis);
      } else {
        await register({
          vardas,
          pavarde,
          el_pastas: elPastas,
          telefono_nr: telefonoNr,
          gimimo_data: gimimoData,
          slaptazodis,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko atlikti veiksmo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // z-[2000] - Leaflet žemėlapio (/automobiliai) vidiniai sluoksniai siekia iki z-index:1000
    // (žr. tą pačią pastabą PublicHeader.tsx) - z-50 čia leisdavo žemėlapiui "pavogti"
    // paspaudimus per modalą ir jis neatsidarydavo/neblur'indavo fono tame puslapyje.
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-[#0E1525] border border-[#1C2B3A] rounded-2xl shadow-2xl px-8 py-9 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#3D4F63] hover:text-[#F7F7F7] hover:bg-[#1A2238] transition"
          aria-label="Uždaryti"
        >
          <FiX className="text-lg" />
        </button>

        <div className="flex justify-center mb-5">
          <Image src={logo} alt="AutoRent" width={56} height={52} className="object-contain" />
        </div>

        {customer ? (
          <>
            <h2 className="text-[#F7F7F7] text-lg font-semibold text-center mb-1">
              Sveiki, {customer.vardas}
            </h2>
            <p className="text-[#707070] text-sm text-center mb-7">{customer.el_pastas}</p>
            <Link
              href="/paskyra"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-semibold py-2.5 rounded-lg transition"
            >
              Mano paskyra
            </Link>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-[#1A2238] hover:bg-[#1E2A47] border border-[#1C2B3A] text-[#8899AA] text-sm font-medium py-2.5 rounded-lg transition"
            >
              Atsijungti
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[#F7F7F7] text-lg font-semibold text-center mb-1">
              {mode === "login" ? "Prisijunkite prie AutoRent" : "Susikurkite paskyrą"}
            </h2>
            <p className="text-[#707070] text-sm text-center mb-6">
              {mode === "login"
                ? "Peržiūrėkite savo nuomas ir tvarkykite rezervacijas."
                : "Užtruks minutę - vėliau rezervuosite greičiau."}
            </p>

            <button
              onClick={() => { window.location.href = `${API}/api/v1/customer/google/login`; }}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 text-sm font-semibold py-2.5 rounded-lg transition shadow"
            >
              <FcGoogle size={20} />
              Tęsti su Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#1C2B3A]" />
              <span className="text-[#3D4F63] text-xs">arba</span>
              <div className="flex-1 h-px bg-[#1C2B3A]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    value={vardas}
                    onChange={(e) => setVardas(e.target.value)}
                    placeholder="Vardas"
                    className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
                  />
                  <input
                    required
                    value={pavarde}
                    onChange={(e) => setPavarde(e.target.value)}
                    placeholder="Pavardė"
                    className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
                  />
                </div>
              )}
              <input
                required
                type="email"
                value={elPastas}
                onChange={(e) => setElPastas(e.target.value)}
                placeholder="El. paštas"
                className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
              />
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    value={telefonoNr}
                    onChange={(e) => setTelefonoNr(e.target.value)}
                    placeholder="Tel. nr."
                    className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
                  />
                  <input
                    required
                    type="date"
                    value={gimimoData}
                    onChange={(e) => setGimimoData(e.target.value)}
                    className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
                  />
                </div>
              )}
              <input
                required
                type="password"
                value={slaptazodis}
                onChange={(e) => setSlaptazodis(e.target.value)}
                placeholder="Slaptažodis"
                minLength={6}
                className="w-full bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F597B]"
              />

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0F597B] hover:bg-[#0C4A66] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                {submitting ? "Palaukite..." : mode === "login" ? "Prisijungti" : "Registruotis"}
              </button>
            </form>

            <button
              onClick={() => {
                setError(null);
                setMode(mode === "login" ? "register" : "login");
              }}
              className="mt-4 w-full text-center text-xs text-[#8899AA] hover:text-[#4BAFD4] transition"
            >
              {mode === "login" ? "Neturite paskyros? Registruokitės" : "Jau turite paskyrą? Prisijunkite"}
            </button>
          </>
        )}

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#1C2B3A]" />
          <span className="text-[#3D4F63] text-xs">arba</span>
          <div className="flex-1 h-px bg-[#1C2B3A]" />
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-[#8899AA] hover:text-[#4BAFD4] transition"
        >
          <FiBriefcase className="shrink-0" />
          Prisijungimas darbuotojams
        </Link>
      </div>
    </div>
  );
}
