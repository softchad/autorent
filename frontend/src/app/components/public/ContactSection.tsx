"use client";

import { useState } from "react";
import Image from "next/image";
import { FaStar } from "react-icons/fa";
import { FiUser, FiLogIn } from "react-icons/fi";
import dots from "@/assets/var1.png";
import SignInModal from "./SignInModal";
import SupportInbox from "./SupportInbox";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";

// Spalvos paimtos iš darbuotojų dashboard StatCard komponento, kad viešas puslapis
// naudotų tą pačią spalvų kalbą kaip vidinė sistema.
const AVATAR_COLORS = ["#163858", "#3D3F5A", "#5B2C3A"];

type Review = {
  name: string;
  city: string;
  quote: string;
  anonymous?: boolean;
};

// Sąmoningai tik keli, aiškiai pažymėti PAVYZDINIAI atsiliepimai (ne begalinis
// karuselis su 17 "penkių žvaigždučių" įrašų) - kad puslapis neapgaudinėtų dėl to,
// kiek realaus socialinio įrodymo šiuo metu yra. Realūs atsiliepimai ateis su
// kliento paskyra po užbaigtos nuomos.
const reviews: Review[] = [
  { name: "Aistė K.", city: "Vilnius", quote: "Rezervavau per penkias minutes, viskas buvo aišku nuo pat pradžių." },
  { name: "Rokas J.", city: "Kaunas", quote: "Patiko, kad kaina nesikeitė atsiėmimo metu. Jokių netikėtų priedų." },
  { anonymous: true, name: "Anonimas", city: "Panevėžys", quote: "Paprastas ir greitas procesas, be jokių paslėptų sąlygų sutartyje." },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div className="w-full rounded-xl border border-[#1C2B3A] bg-[#0E1525] p-6">
      <div className="flex gap-0.5 text-[#4BAFD4] mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <FaStar key={i} className="text-sm" />
        ))}
      </div>
      <p className="text-sm text-[#C5CEDA] leading-relaxed mb-5 min-h-[4.5rem]">&ldquo;{review.quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#F7F7F7]"
          style={{ backgroundColor: review.anonymous ? "#1A2238" : color }}
        >
          {review.anonymous ? <FiUser className="text-[#3D4F63]" /> : initials(review.name)}
        </div>
        <div>
          <p className="text-xs font-medium text-[#F7F7F7]">{review.name}</p>
          <p className="text-[11px] text-[#707070]">{review.city}</p>
        </div>
      </div>
    </div>
  );
}

export default function ContactSection() {
  const { customer, token } = useCustomerAuth();
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      {/* Atsiliepimai */}
      <section className="relative overflow-hidden border-y border-[#1C2B3A] bg-[#080617] py-16">
        <Image
          src={dots}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 w-64 opacity-20"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] mb-2">Ką sako klientai</h2>
          <p className="text-[#8899AA] text-sm max-w-xl">
            Tikrų atsiliepimų dar neturime - rezervavimas internetu ir kliento paskyra bus pasiekiami kitame etape.
            Žemiau tik trys pavyzdiniai įrašai, rodantys, kaip atsiliepimai atrodys ateityje.
          </p>
        </div>

        <div className="relative mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {reviews.map((r, i) => (
              <div key={r.name} className="relative">
                <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-[#0F597B] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Pavyzdys
                </span>
                <ReviewCard review={r} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pagalba */}
      <section id="kontaktai" className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-8 sm:p-10">
          <h3 className="text-xl font-bold text-[#F7F7F7] mb-2 text-center">Reikia pagalbos?</h3>

          {customer ? (
            <>
              <p className="text-sm text-[#8899AA] leading-relaxed text-center mb-6">
                Parašyk mums žemiau - atsakysime čia pat, žinutę visada gali peržiūrėti savo paskyroje.
              </p>
              <SupportInbox token={token} compact />
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-[#8899AA] leading-relaxed max-w-sm mx-auto mb-6">
                Susisiekimas veikia per kliento paskyrą - taip tavo žinutė ir atsakymas visada lieka vienoje vietoje,
                o ne pasimeta el. pašte. Prisijunk, kad galėtum parašyti mums.
              </p>
              <button
                onClick={() => setSignInOpen(true)}
                className="inline-flex items-center gap-2 bg-[#0F597B] hover:bg-[#0C4A66] text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                <FiLogIn />
                Prisijungti ir rašyti
              </button>
            </div>
          )}
        </div>
      </section>

      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
