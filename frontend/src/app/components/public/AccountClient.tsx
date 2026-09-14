"use client";

import { useState } from "react";
import Link from "next/link";
import { FiUser, FiMail, FiPhone, FiCalendar, FiLogOut, FiGift, FiInbox, FiHelpCircle } from "react-icons/fi";
import PublicPageShell from "./PublicPageShell";
import StatusBadge from "@/app/components/StatusBadge";
import LoyaltyRoad from "./LoyaltyRoad";
import SupportInbox from "./SupportInbox";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";
import { useCustomerReservations } from "@/hooks/useCustomerReservations";
import { useCustomerLoyalty } from "@/hooks/useCustomerLoyalty";

type SupportPrefill = { kategorija: string; tema: string; rezervacijos_id?: number };

function formatLt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

type Tab = "profilis" | "pastas";

export default function AccountClient() {
  const { customer, token, isLoading, logout } = useCustomerAuth();
  const { reservations, isLoading: reservationsLoading } = useCustomerReservations(token);
  const { status: loyalty, redeemError, redeem } = useCustomerLoyalty(token);
  const unredeemedRewards = loyalty?.atlygiai.filter((r) => r.busena === "neisnaudotas") ?? [];
  const [tab, setTab] = useState<Tab>("profilis");
  const [supportPrefill, setSupportPrefill] = useState<SupportPrefill | null>(null);

  const askForHelp = (reservation: { rezervacijos_id: number; marke: string; modelis: string }) => {
    setSupportPrefill({
      kategorija: "rezervacija",
      tema: `Klausimas dėl nuomos - ${reservation.marke} ${reservation.modelis}`,
      rezervacijos_id: reservation.rezervacijos_id,
    });
    setTab("pastas");
  };

  return (
    <PublicPageShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {isLoading && <p className="text-sm text-[#8899AA]">Kraunama...</p>}

        {!isLoading && !customer && (
          <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-10 text-center">
            <h1 className="text-xl font-bold text-[#F7F7F7] mb-2">Reikia prisijungti</h1>
            <p className="text-sm text-[#8899AA] mb-6">
              Kad pamatytum savo paskyrą, prisijunk per antraštėje esantį mygtuką &quot;Prisijungti&quot;.
            </p>
            <Link href="/" className="text-sm text-[#4BAFD4] hover:underline">
              Grįžti į pradinį puslapį
            </Link>
          </div>
        )}

        {!isLoading && customer && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] mb-1">Mano paskyra</h1>
            <p className="text-sm text-[#8899AA] mb-6">
              {customer.vardas} {customer.pavarde}
            </p>

            <div className="mb-8 flex gap-1 border-b border-[#1C2B3A]">
              <button
                onClick={() => setTab("profilis")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  tab === "profilis"
                    ? "border-[#0F597B] text-[#F7F7F7]"
                    : "border-transparent text-[#8899AA] hover:text-[#F7F7F7]"
                }`}
              >
                <FiUser /> Profilis
              </button>
              <button
                onClick={() => setTab("pastas")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  tab === "pastas"
                    ? "border-[#0F597B] text-[#F7F7F7]"
                    : "border-transparent text-[#8899AA] hover:text-[#F7F7F7]"
                }`}
              >
                <FiInbox /> Pašto dėžutė
              </button>
            </div>

            {tab === "profilis" && (
              <>
                <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-6 mb-6">
                  <h2 className="text-sm font-semibold text-[#F7F7F7] uppercase tracking-wide mb-4">Profilis</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<FiUser />} label="Vardas, pavardė" value={`${customer.vardas} ${customer.pavarde}`} />
                    <InfoRow icon={<FiMail />} label="El. paštas" value={customer.el_pastas} />
                    <InfoRow icon={<FiPhone />} label="Telefonas" value={customer.telefono_nr || "Nenurodyta"} />
                    <InfoRow icon={<FiCalendar />} label="Gimimo data" value={formatLt(customer.gimimo_data)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-6 mb-6">
                  <h2 className="text-sm font-semibold text-[#F7F7F7] uppercase tracking-wide mb-1">
                    Tavo kelias iki atlygio
                  </h2>
                  <p className="text-xs text-[#707070] mb-5">
                    Kas {loyalty?.etapo_dydis ?? 5} užbaigtos nuomos - {loyalty?.atlygio_verte_eur ?? 20} € nuolaidos
                    kuponas kitai nuomai. Tai pavyzdinė taisyklė, kol nesukurta pilna mokėjimų apskaita.
                  </p>

                  {loyalty && <LoyaltyRoad progress={loyalty.progresas_dabartiniame_etape} size={loyalty.etapo_dydis} />}

                  {unredeemedRewards.length > 0 && (
                    <div className="mt-5 space-y-2">
                      {unredeemedRewards.map((r) => (
                        <div
                          key={r.atlygio_id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#0F597B]/40 bg-[#0F597B]/10 p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <FiGift className="shrink-0 text-[#4BAFD4]" />
                            <span className="text-sm text-[#F7F7F7]">
                              Uždirbtas {r.verte_eur} € nuolaidos kuponas (etapas #{r.etapo_numeris})
                            </span>
                          </div>
                          <button
                            onClick={() => redeem(r.atlygio_id)}
                            className="shrink-0 rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] text-white text-xs font-semibold px-3 py-1.5 transition"
                          >
                            Panaudoti
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {redeemError && <p className="mt-2 text-xs text-red-400">{redeemError}</p>}
                </div>

                <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-6 mb-6">
                  <h2 className="text-sm font-semibold text-[#F7F7F7] uppercase tracking-wide mb-4">Mano nuomos</h2>

                  {reservationsLoading && <p className="text-sm text-[#8899AA]">Kraunama...</p>}

                  {!reservationsLoading && reservations.length === 0 && (
                    <p className="text-sm text-[#8899AA]">
                      Rezervacijų dar nėra. Susirask automobilį{" "}
                      <Link href="/automobiliai" className="text-[#4BAFD4] hover:underline">
                        kataloge
                      </Link>{" "}
                      ir rezervuok jo puslapyje.
                    </p>
                  )}

                  {!reservationsLoading && reservations.length > 0 && (
                    <div className="space-y-3">
                      {reservations.map((r) => (
                        <div
                          key={r.rezervacijos_id}
                          className="rounded-xl border border-[#1C2B3A] bg-[#0E0B1F] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Link href={`/automobiliai/${r.automobilio_id}`} className="hover:text-[#4BAFD4] transition">
                              <p className="text-sm font-semibold text-[#F7F7F7]">
                                {r.marke} {r.modelis}
                              </p>
                            </Link>
                            <StatusBadge status={r.busena} />
                          </div>
                          <p className="mt-1 text-xs text-[#707070]">
                            {formatLt(r.rezervacijos_pradzia)} - {formatLt(r.rezervacijos_pabaiga)} &bull;{" "}
                            {r.dienu_skaicius} {r.dienu_skaicius === 1 ? "diena" : "dienos"} &bull; {r.viso_kaina} €
                          </p>
                          <button
                            onClick={() => askForHelp(r)}
                            className="mt-2 flex items-center gap-1.5 text-xs text-[#4BAFD4] hover:underline"
                          >
                            <FiHelpCircle /> Reikia pagalbos dėl šios nuomos
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm text-[#8899AA] hover:text-[#F7F7F7] transition"
                >
                  <FiLogOut /> Atsijungti
                </button>
              </>
            )}

            {tab === "pastas" && (
              <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-6">
                <SupportInbox token={token} initialPrefill={supportPrefill} />
              </div>
            )}
          </>
        )}
      </div>
    </PublicPageShell>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[#4BAFD4]">{icon}</span>
      <div>
        <p className="text-xs text-[#707070]">{label}</p>
        <p className="text-sm text-[#F7F7F7]">{value}</p>
      </div>
    </div>
  );
}
