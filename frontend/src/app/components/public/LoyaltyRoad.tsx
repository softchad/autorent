"use client";

import { FiTruck, FiFlag, FiCheck } from "react-icons/fi";

// Vizualus "kelias iki atlygio" - automobilio ikona juda per etapo_dydis žingsnių.
// Tekstinė santrauka visada rodoma greta (ne vien vizualiai), o judėjimas
// gerbia prefers-reduced-motion. Žr. docs/AUTORENT_PLETROS_PLANAS.md 5 skyrių.
export default function LoyaltyRoad({ progress, size }: { progress: number; size: number }) {
  const clamped = Math.min(Math.max(progress, 0), size);
  const percent = size > 0 ? (clamped / size) * 100 : 0;
  const complete = clamped >= size;

  return (
    <div>
      <div className="relative pt-9 pb-2">
        {/* Automobilio žymeklis */}
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${percent}%` }}
          aria-hidden="true"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4BAFD4] text-[#0E0B1F] shadow-[0_2px_10px_rgba(75,175,212,0.5)]">
            <FiTruck className="text-sm" />
          </span>
        </div>

        <div className="relative flex items-center">
          {Array.from({ length: size }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center last:flex-none">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  i < clamped
                    ? "border-[#0F597B] bg-[#0F597B] text-white"
                    : "border-[#1C2B3A] bg-[#1A2238] text-[#707070]"
                }`}
              >
                {i < clamped ? <FiCheck className="text-sm" /> : i + 1}
              </div>
              {i < size - 1 && (
                <div className={`h-0.5 flex-1 ${i < clamped ? "bg-[#0F597B]" : "bg-[#1C2B3A]"}`} />
              )}
            </div>
          ))}
          <span
            className={`ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
              complete ? "border-emerald-600 bg-emerald-600/20 text-emerald-400" : "border-[#1C2B3A] text-[#3D4F63]"
            }`}
            aria-hidden="true"
          >
            <FiFlag className="text-sm" />
          </span>
        </div>
      </div>

      <p className="text-sm text-[#C5CEDA]">
        Užbaigtos <span className="font-semibold text-[#F7F7F7]">{clamped}</span> iš {size} nuomų iki kito atlygio.
      </p>
    </div>
  );
}
