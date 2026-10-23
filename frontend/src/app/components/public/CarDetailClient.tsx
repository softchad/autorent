"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FiArrowLeft,
  FiUsers,
  FiSettings,
  FiDroplet,
  FiMapPin,
  FiWind,
  FiNavigation,
  FiCalendar,
} from "react-icons/fi";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import MapTexture from "./MapTexture";
import DatePicker from "./DatePicker";
import SignInModal from "./SignInModal";
import StatusBadge from "@/app/components/StatusBadge";
import { SearchValue } from "./SearchForm";
import { usePublicCar, useCarBusyDates } from "@/hooks/usePublicCars";
import { getCarPhoto } from "@/utils/carPhoto";
import { buildAutomobiliaiHref } from "@/utils/publicSearch";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";
import { createCustomerReservation, CustomerReservation } from "@/hooks/useCustomerReservations";
import { defaultDateRange, nextDay } from "@/utils/formatLt";

const STATUS_NOTE: Record<string, string> = {
  laisvas: "Šis automobilis šiuo metu laisvas.",
  isnuomotas: "Šis automobilis šiuo metu išnuomotas kitam klientui.",
  servise: "Šis automobilis šiuo metu techninėje priežiūroje.",
  remonte: "Šis automobilis šiuo metu remontuojamas.",
};

export default function CarDetailClient({ id, initialDates }: { id: number; initialDates?: { dateFrom: string; dateTo: string } }) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchValue>({ location: "", ...(initialDates ?? defaultDateRange()) });
  const { car, isLoading, notFound, error: dateRangeError } = usePublicCar(id, { dateFrom: search.dateFrom, dateTo: search.dateTo });
  const busyDates = useCarBusyDates(id);
  const hasDateRange = Boolean(search.dateFrom && search.dateTo);

  const { customer, token } = useCustomerAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [booking, setBooking] = useState<"idle" | "submitting" | "error">("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedReservation, setBookedReservation] = useState<CustomerReservation | null>(null);
  // Jei "Rezervuoti" paspausta neprisijungus - šis flag'as leidžia AUTOMATIŠKAI
  // užbaigti rezervaciją iškart po sėkmingo prisijungimo (žr. useEffect žemiau),
  // kad vartotojui nereikėtų antrą kartą spausti to pačio mygtuko.
  const [pendingReservation, setPendingReservation] = useState(false);

  const days = hasDateRange
    ? Math.round(
        (new Date(search.dateTo).getTime() - new Date(search.dateFrom).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const handleReserve = async () => {
    if (booking === "submitting" || dateRangeError || isLoading) return;
    if (!customer || !token || !car) {
      setPendingReservation(true);
      setSignInOpen(true);
      return;
    }
    setBooking("submitting");
    setBookingError(null);
    try {
      const reservation = await createCustomerReservation(token, car.automobilio_id, search.dateFrom, search.dateTo);
      setBookedReservation(reservation);
      setBooking("idle");
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Nepavyko sukurti rezervacijos");
      setBooking("error");
    }
  };

  // Užbaigia atidėtą rezervaciją, kai "customer"/"token" atsiranda PO sėkmingo
  // prisijungimo SignInModal'e (žr. "pendingReservation" aukščiau).
  useEffect(() => {
    if (pendingReservation && customer && token) {
      setPendingReservation(false);
      handleReserve();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReservation, customer, token]);

  return (
    // Be overflow-x-hidden ČIA - tai laužia PublicHeader "sticky" pozicionavimą (CSS elgesys: overflow-x nustatymas protėvyje sukuria naują scroll konteinerį, kuriame sticky elementas "prilimpa" tik PRIE JO, o ne prie realaus naršyklės lango); horizontalus persiliejimas jau apsaugotas lokaliai - MapTexture žemiau turi savo overflow-hidden.
    <div className="relative min-h-screen bg-[#0B121F]">
      <MapTexture />
      <div className="relative z-10">
        <PublicHeader
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={() => router.push(buildAutomobiliaiHref(search))}
        />

        <main>
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <Link
              href="/automobiliai"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#8899AA] hover:text-[#F7F7F7] transition"
            >
              <FiArrowLeft /> Visi automobiliai
            </Link>

            {isLoading && (
              <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-16 text-center text-sm text-[#8899AA]">
                Kraunama...
              </div>
            )}

            {!isLoading && notFound && (
              <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-16 text-center">
                <p className="text-sm text-[#8899AA] mb-3">Tokio automobilio nerasta.</p>
                <Link href="/automobiliai" className="text-sm text-[#4BAFD4] hover:underline">
                  Grįžti į automobilių sąrašą
                </Link>
              </div>
            )}

            {!isLoading && !notFound && dateRangeError && (
              <p role="alert" className="mb-4 rounded-xl border border-red-900 p-4 text-red-300">{dateRangeError}</p>
            )}

            {!isLoading && !notFound && car && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
                <div>
                  <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-[#1C2B3A]">
                    <Image
                      src={getCarPhoto(car)}
                      alt={`${car.marke} ${car.modelis}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover"
                      priority
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-[#0B121F]/80 backdrop-blur px-2.5 py-1 text-[10px] font-medium text-[#8899AA]">
                      Iliustracinė nuotrauka
                    </span>
                    <div className="absolute right-3 top-3">
                      <StatusBadge status={car.automobilio_statusas} />
                    </div>
                  </div>

                  <div className="mt-6 flex items-start justify-between gap-4">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7]">
                        {car.marke} {car.modelis}
                      </h1>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#8899AA]">
                        <FiCalendar className="shrink-0" /> {car.metai} m. &bull; {car.spalva}
                      </p>
                    </div>
                  </div>

                  {!hasDateRange && (
                    <p className="mt-3 text-sm text-[#8899AA]">
                      {STATUS_NOTE[car.automobilio_statusas] ?? "Būsena nenurodyta."}
                    </p>
                  )}

                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Spec icon={<FiUsers />} label="Sėdimos vietos" value={String(car.sedimos_vietos)} />
                    <Spec icon={<FiSettings />} label="Pavarų dėžė" value={car["pavaru_deze"]} />
                    <Spec icon={<FiDroplet />} label="Kuro tipas" value={car.kuro_tipas} />
                    <Spec icon={<FiWind />} label="Klimato kontrolė" value={car.klimato_kontrole ? "Yra" : "Nėra"} />
                    <Spec icon={<FiNavigation />} label="Navigacija" value={car.navigacija ? "Yra" : "Nėra"} />
                    <Spec label="Kėbulo tipas" value={car.kebulo_tipas} />
                    <Spec label="Variklio tūris" value={`${car.variklio_turis} L`} />
                    <Spec label="Galia" value={`${car.galia_kw} kW`} />
                    <Spec label="Rida" value={`${car.rida.toLocaleString("lt-LT")} km`} />
                  </div>

                  {car.lokacija && (
                    <div className="mt-8 rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-5">
                      <h2 className="text-sm font-semibold text-[#F7F7F7] mb-2">Paėmimo vieta</h2>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(car.lokacija.adresas)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-sm text-[#8899AA] hover:text-[#4BAFD4] transition"
                      >
                        <FiMapPin className="mt-0.5 shrink-0 text-[#4BAFD4]" />
                        <span>
                          {car.lokacija.pavadinimas}
                          <br />
                          {car.lokacija.adresas}
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                <aside className="lg:sticky lg:top-24 lg:self-start rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-6 h-fit">
                  {bookedReservation ? (
                    <>
                      <div className="mb-4 rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-3 py-2 text-sm font-medium text-emerald-300">
                        Rezervacija pateikta - laukiama darbuotojo patvirtinimo
                      </div>
                      <div className="space-y-2 text-sm text-[#C5CEDA] mb-4">
                        <div className="flex justify-between">
                          <span className="text-[#707070]">Laikotarpis</span>
                          <span>
                            {bookedReservation.rezervacijos_pradzia} - {bookedReservation.rezervacijos_pabaiga}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#707070]">Dienos</span>
                          <span>{bookedReservation.dienu_skaicius}</span>
                        </div>
                        <div className="flex justify-between border-t border-[#1C2B3A] pt-2 font-semibold text-[#F7F7F7]">
                          <span>Iš viso</span>
                          <span>{bookedReservation.viso_kaina} €</span>
                        </div>
                      </div>
                      <Link
                        href="/paskyra"
                        className="block w-full rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] text-white text-center font-medium py-2.5 text-sm transition"
                      >
                        Peržiūrėti Mano paskyroje
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between border-b border-[#1C2B3A] pb-4 mb-4">
                        <span className="text-xs text-[#707070]">Kaina</span>
                        <span className="text-2xl font-bold text-[#F7F7F7]">
                          {car.kaina_parai} € <span className="text-xs font-normal text-[#707070]">/ parai</span>
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[#F7F7F7] mb-2">Pasirink nuomos laikotarpį</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <DatePicker
                          label="Nuo"
                          value={search.dateFrom}
                          onChange={(v) =>
                            setSearch((s) => ({
                              ...s,
                              dateFrom: v,
                              // "Iki" negali likti <= naujos "Nuo" - kitaip trumpam
                              // atsiranda negaliojantis intervalas ir serveris grąžina
                              // 400, kol antras laukas spėja atsinaujinti.
                              dateTo: s.dateTo && s.dateTo > v ? s.dateTo : nextDay(v),
                            }))
                          }
                          allowClear={false}
                          disabledDates={busyDates}
                        />
                        <DatePicker
                          label="Iki"
                          value={search.dateTo}
                          onChange={(v) => setSearch((s) => ({ ...s, dateTo: v }))}
                          minDate={nextDay(search.dateFrom)}
                          allowClear={false}
                          maxDate={[...busyDates].filter((date) => date >= search.dateFrom).sort()[0]}
                        />
                      </div>

                      {dateRangeError && (
                        <div className="mb-3 rounded-lg px-3 py-2 text-sm font-medium bg-rose-900/30 text-rose-300 border border-rose-700/40">
                          {dateRangeError}
                        </div>
                      )}

                      {!dateRangeError && hasDateRange && (
                        <div
                          className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${
                            car.laisvas_pasirinktu_laikotarpiu
                              ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700/40"
                              : "bg-rose-900/30 text-rose-300 border border-rose-700/40"
                          }`}
                        >
                          {car.laisvas_pasirinktu_laikotarpiu
                            ? "Laisvas pasirinktu laikotarpiu"
                            : "Užimtas pasirinktu laikotarpiu"}
                        </div>
                      )}

                      {hasDateRange && car.laisvas_pasirinktu_laikotarpiu && (
                        <div className="mb-4 flex justify-between text-sm text-[#C5CEDA]">
                          <span className="text-[#707070]">
                            {days} {days === 1 ? "diena" : "dienos"} x {car.kaina_parai} €
                          </span>
                          <span className="font-semibold text-[#F7F7F7]">{(days * car.kaina_parai).toFixed(2)} €</span>
                        </div>
                      )}

                      <button
                        onClick={handleReserve}
                        disabled={!hasDateRange || Boolean(dateRangeError) || !car.laisvas_pasirinktu_laikotarpiu || booking === "submitting"}
                        title={
                          !hasDateRange
                            ? "Pasirink nuomos laikotarpį"
                            : !car.laisvas_pasirinktu_laikotarpiu
                              ? "Automobilis užimtas pasirinktu laikotarpiu"
                              : undefined
                        }
                        className="w-full rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] disabled:bg-[#0F597B]/30 disabled:text-[#8899AA] disabled:cursor-not-allowed text-white font-medium py-2.5 text-sm transition"
                      >
                        {booking === "submitting"
                          ? "Rezervuojama..."
                          : !customer && hasDateRange && car.laisvas_pasirinktu_laikotarpiu
                            ? "Prisijungti ir rezervuoti"
                            : "Rezervuoti"}
                      </button>
                      {bookingError && <p className="mt-2 text-xs text-red-400 text-center">{bookingError}</p>}
                      <p className="mt-3 text-xs text-[#707070] text-center">
                        Rezervaciją peržiūrės ir patvirtins AutoRent darbuotojas.
                      </p>
                    </>
                  )}
                </aside>
              </div>
            )}
          </div>
        </main>

        <PublicFooter />
      </div>

      <SignInModal returnTo={`/automobiliai/${id}?${new URLSearchParams({ dateFrom: search.dateFrom, dateTo: search.dateTo })}`} isOpen={signInOpen} onSuccess={() => setSignInOpen(false)} onClose={() => { setSignInOpen(false); setPendingReservation(false); }} />
    </div>
  );
}

function Spec({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1C2B3A] bg-[#0E1525] p-3">
      <div className="flex items-center gap-1.5 text-xs text-[#707070] mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-[#F7F7F7]">{value}</div>
    </div>
  );
}
