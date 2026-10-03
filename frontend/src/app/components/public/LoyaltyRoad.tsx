"use client";

import { FiFlag, FiCheck } from "react-icons/fi";

// Vizualus "kelias iki atlygio" - etapai sujungti linijomis, be tarpų iki kraštų.
// Tekstinė santrauka visada rodoma greta (ne vien vizualiai). Didelė, translucent
// vėliavos ikona fone - tik dekoratyvus "finišo" akcentas, ne tikra nuotrauka.
export default function LoyaltyRoad({ progress, size }: { progress: number; size: number }) {
  const clamped = Math.min(Math.max(progress, 0), size);
  const complete = clamped >= size;

  return (
    <div className="relative">
      <FiFlag
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-3 text-[88px] text-[#0F597B]/10"
      />

      <div className="relative flex items-center py-2">
        {Array.from({ length: size }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold transition-colors ${
                i < clamped
                  ? "border-[#0F597B] bg-[#0F597B] text-white"
                  : "border-[#1C2B3A] bg-[#1A2238] text-[#707070]"
              }`}
            >
              {i < clamped ? <FiCheck /> : i + 1}
            </div>
            {i < size - 1 && (
              <div className={`h-1 flex-1 ${i < clamped ? "bg-[#0F597B]" : "bg-[#1C2B3A]"}`} />
            )}
          </div>
        ))}
      </div>

      <p className="relative text-sm text-[#C5CEDA]">
        Užbaigtos <span className="font-semibold text-[#F7F7F7]">{clamped}</span> iš {size} nuomų iki kito atlygio.
        {complete && <span className="ml-1 text-[#4BAFD4]">Atlygis uždirbtas!</span>}
      </p>
    </div>
  );
}
