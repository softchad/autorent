"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  FiAward,
  FiTruck,
  FiMapPin,
  FiTag,
  FiClock,
  FiDollarSign,
  FiZap,
  FiThumbsUp,
  FiCalendar,
} from "react-icons/fi";
import PublicHeader from "@/app/components/public/PublicHeader";
import PublicFooter from "@/app/components/public/PublicFooter";
import SearchForm, { SearchValue } from "@/app/components/public/SearchForm";
import FaqItem from "@/app/components/public/FaqItem";
import BrandLogos from "@/app/components/public/BrandLogos";
import MapTexture from "@/app/components/public/MapTexture";
import { buildAutomobiliaiHref } from "@/utils/publicSearch";
import { defaultDateRange } from "@/utils/formatLt";
import BarChartBox from "@/app/components/BarChartBox";
import PieChartBox from "@/app/components/PieChartBox";
import stripes from "@/assets/var2.png";
import dotsBg from "@/assets/var1.png";

// Nuotraukų šaltiniai nepatvirtinti - žr. public/images/fleet/CREDITS.md prieš publikavimą.
// href - NUSTATYTA TIK kai kortelė realiai atitinka filtruojamą lauką (kebulo_tipas
// arba kuro_tipas) DB. Grynai estetinės kategorijos (sportinė/prabangos klasė,
// dinamiškas dizainas...) neturi tokio lauko sistemoje, tad veda į bendrą sąrašą,
// ne į suklastotą filtrą.
const fleetPhotos = [
  {
    src: "/images/fleet/hero-dark-car.jpg",
    title: "Verslo ir sportinė klasė",
    desc: "Dinamiškos linijos ir aukšta komplektacija kelionėms, kuriose svarbus pirmas įspūdis.",
    href: "/automobiliai",
  },
  {
    src: "/images/fleet/silver-sports-car.jpg",
    title: "Sportinė klasė",
    desc: "Aštrios linijos ir įspūdingas pagreitis, kai kelionė turi būti neužmirštama.",
    href: "/automobiliai",
  },
  {
    src: "/images/fleet/suv-studio.jpg",
    title: "Visureigiai ir šeimyniniai",
    desc: "Daugiau vietos bagažui ir keleiviams, patogu šeimos kelionėms ar važiavimui su įranga.",
    href: "/automobiliai?kebulas=Visureigis",
  },
  {
    src: "/images/fleet/red-convertible.jpg",
    title: "Kabrioletai",
    desc: "Atviras stogas kelionei, kurioje svarbus ne tik tikslas, bet ir pats vairavimo jausmas.",
    href: "/automobiliai?kebulas=Kabrioletas",
  },
  {
    src: "/images/fleet/ev-charging.jpg",
    title: "Elektromobiliai",
    desc: "Tyliau, švariau ir pigiau kasdieniam važinėjimui po miestą ar trumpiems maršrutams.",
    href: "/automobiliai?kuras=elektra",
  },
  {
    src: "/images/fleet/black-sports-car.jpg",
    title: "Prabangos klasė",
    desc: "Aukščiausios klasės komplektacija ir dėmesys kiekvienai detalei.",
    href: "/automobiliai",
  },
  {
    src: "/images/fleet/sedan-highway.jpg",
    title: "Kelionėms tarp miestų",
    desc: "Ekonomiški ir patikimi automobiliai ilgesniems maršrutams per visą Lietuvą.",
    href: "/automobiliai?kebulas=Sedanas",
  },
  {
    src: "/images/fleet/grey-sports-car.jpg",
    title: "Dinamiškas dizainas",
    desc: "Aerodinamiškos formos, sukurtos ne tik greičiui, bet ir įspūdžiui kelyje.",
    href: "/automobiliai",
  },
];

const steps = [
  {
    title: "Pasirink automobilį",
    desc: "Naršyk pasiūlymus, palygink kainas pagal kuro tipą ir kėbulo klasę. Viską gali padaryti be registracijos, tiesiog atsidaręs svetainę.",
  },
  {
    title: "Rezervuok internetu",
    desc: "Nurodysi paėmimo vietą ir datas, iš karto pamatysi aiškią kainą be paslėptų mokesčių. Patvirtinimą gauni iš karto, be skambučių ir laukimo.",
  },
  {
    title: "Atsiimk ir važiuok",
    desc: "Susitinkame sutartoje vietoje sutartu laiku. Likusius formalumus sutvarkome vietoje per kelias minutes, o tu iškart išvažiuoji.",
  },
];

const whyUs = [
  {
    icon: FiDollarSign,
    title: "Skaidri kaina",
    desc: "Kainą matai iš karto, be paslėptų mokesčių ar netikėtų priedų atsiimant automobilį.",
  },
  {
    icon: FiTruck,
    title: "Platus pasirinkimas",
    desc: "Nuo ekonominės klasės iki elektromobilių: kolekcija auga kiekvieną mėnesį.",
  },
  {
    icon: FiMapPin,
    title: "10 miestų Lietuvoje",
    desc: "Atsiimk ir grąžink automobilį patogiausiame tau padalinyje, nuo Vilniaus iki Telšių.",
  },
  {
    icon: FiCalendar,
    title: "Lankstus bendravimas",
    desc: "Planai keičiasi - susisiek su mumis ir padėsime pakoreguoti ar atšaukti rezervaciją prieš paėmimo laiką.",
  },
  {
    icon: FiZap,
    title: "Greita rezervacija",
    desc: "Nuo paieškos iki patvirtinimo prabėga vos kelios minutės, be popierizmo ir eilių.",
  },
  {
    icon: FiThumbsUp,
    title: "Lojalumo programa",
    desc: "Kiekviena užbaigta nuoma artina prie atlygio - progresą sekti gali savo paskyroje.",
  },
];

// Realios šiandienos AutoRent parko kainos (2026-09), grupuota pagal kuro tipą.
const deals = [
  {
    label: "Benzininiai",
    from: 30,
    photo: "/images/fleet/sedan-highway.jpg",
    tag: "Populiariausia",
    desc: "Universalus pasirinkimas kasdieniam važinėjimui ir trumpoms kelionėms po miestą.",
  },
  {
    label: "Dyzeliniai",
    from: 50,
    photo: "/images/fleet/suv-studio.jpg",
    tag: "Ilgoms kelionėms",
    desc: "Mažesnės kuro sąnaudos ilgesniuose maršrutuose ir greitkeliuose per visą šalį.",
  },
  {
    label: "Hibridiniai",
    from: 40,
    photo: "/images/fleet/black-sports-car.jpg",
    tag: "Taupu",
    desc: "Derina degalų taupymą su tylesniu važiavimu mieste: puikus balansas kainos ir naudojimo.",
  },
  {
    label: "Elektromobiliai",
    from: 100,
    photo: "/images/fleet/ev-charging.jpg",
    tag: "Naujiena",
    desc: "Nulinė tarša ir tylus, dinamiškas pagreitis. Ateities vairavimo patirtis jau šiandien.",
  },
];

// Vidutinė kaina/parai pagal kuro tipą, realūs dabartinio automobilių parko skaičiai.
const priceByFuel = [
  { name: "Hibridas", value: 40 },
  { name: "Dyzelinas", value: 63.3 },
  { name: "Benzinas", value: 51 },
  { name: "Elektra", value: 100 },
];

// Automobilių pasiskirstymas pagal kėbulo tipą, realūs dabartinio parko skaičiai.
const carsByBody = [
  { name: "Sedanas", value: 42 },
  { name: "Hečbekas", value: 14 },
  { name: "Visureigis", value: 14 },
];

const faqs = [
  {
    q: "Kokio amžiaus reikia norint išsinuomoti automobilį?",
    a: "Įprastai reikalaujama, kad vairuotojas būtų sulaukęs bent 18 metų ir turėtų galiojantį vairuotojo pažymėjimą. Kai kurioms transporto priemonių kategorijoms, pavyzdžiui, sportinei ar prabangos klasei, gali būti taikomi papildomi amžiaus arba vairavimo stažo reikalavimai.",
  },
  {
    q: "Ar reikalinga išankstinė registracija?",
    a: "Naršyti automobilius, filtruoti pagal tipą ir pamatyti orientacines kainas gali visiškai be registracijos. Rezervacijos patvirtinimui internetu, nuomų istorijai ir lojalumo progresui reikės nemokamos kliento paskyros.",
  },
  {
    q: "Kokie dokumentai reikalingi atsiimant automobilį?",
    a: "Paprastai reikės galiojančio asmens tapatybės dokumento ir vairuotojo pažymėjimo. Rekomenduojame turėtis ir rezervacijos patvirtinimą, kad paėmimas vyktų greičiau.",
  },
  {
    q: "Ar galiu atšaukti arba pakeisti rezervaciją?",
    a: "Rezervaciją gali peržiūrėti savo paskyroje. Jei reikia pakeisti datas ar atšaukti, susisiek su mumis telefonu ar el. paštu - padėsime sutvarkyti greitai.",
  },
  {
    q: "Kaip veikia kuro politika?",
    a: "Automobilis įprastai perduodamas ir turi būti grąžinamas su tokiu pačiu kuro kiekiu, koks buvo nurodytas perdavimo metu. Tai padeda išvengti papildomų mokesčių už kurą.",
  },
  {
    q: "Ar kainoje jau įskaičiuotas draudimas?",
    a: "Rodoma kaina apima bazinę nuomos apsaugą. Dėl papildomo draudimo apimties ar konkrečių sąlygų susisiek su mumis tiesiogiai - sutvarkysime prieš atsiėmimą.",
  },
  {
    q: "Ar galima grąžinti automobilį kitame mieste nei buvo paimtas?",
    a: "Internetinė rezervacija kol kas automobilį priskiria vienam padaliniui. Jei reikia grąžinti kitame mieste, susisiek su mumis - tai sutvarkoma individualiai.",
  },
];

// Realūs padalinių adresai, sutampantys su Pristatymo_Vietos lentele darbuotojų sistemoje.
const locations = [
  { name: "Vilnius Centras", address: "Gedimino pr. 1, Vilnius" },
  { name: "Kaunas Centras", address: "Laisvės al. 10, Kaunas" },
  { name: "Klaipėda", address: "Taikos pr. 20, Klaipėda" },
  { name: "Šiauliai", address: "Tilžės g. 5, Šiauliai" },
  { name: "Panevėžys", address: "Respublikos g. 15, Panevėžys" },
  { name: "Alytus", address: "Naujoji g. 30, Alytus" },
  { name: "Marijampolė", address: "Gedimino g. 5, Marijampolė" },
  { name: "Utena", address: "J. Basanavičiaus g. 3, Utena" },
  { name: "Mažeikiai", address: "Laisvės g. 25, Mažeikiai" },
  { name: "Telšiai", address: "Žemaitijos g. 7, Telšiai" },
];

export default function HomeClient() {
  const router = useRouter();
  const [search, setSearch] = useState<SearchValue>({ location: "", ...defaultDateRange() });

  const handleSearch = () => router.push(buildAutomobiliaiHref(search));

  return (
    // Be overflow-x-hidden ČIA - tai laužia PublicHeader "sticky" pozicionavimą (žinomas
    // CSS elgesys: overflow-x nustatymas protėvyje sukuria naują scroll konteinerį, kuriame
    // sticky elementas "prilimpa" tik PRIE JO, o ne prie realaus naršyklės lango). Horizontalus
    // persiliejimas jau apsaugotas lokaliai - MapTexture ir Hero sekcija turi savo overflow-hidden.
    <div className="relative min-h-screen bg-[#0B121F]">
      <MapTexture />

      <div className="relative z-10">
      <PublicHeader searchValue={search} onSearchChange={setSearch} onSearchSubmit={handleSearch} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/fleet/hero-dark-car.jpg"
              alt="Automobilis tamsiame fone"
              fill
              sizes="100vw"
              priority
              className="object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B121F] via-[#0B121F]/85 to-[#0B121F]/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B121F] via-transparent to-[#0B121F]/60" />
          </div>

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#0F597B]/20 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#0F597B]/40 bg-[#0F597B]/10 px-4 py-1.5 text-xs font-medium text-[#4BAFD4] mb-6">
              <FiMapPin className="text-xs" />
              10 miestų Lietuvoje
            </span>

            <h1 className="text-3xl sm:text-5xl font-bold text-[#F7F7F7] tracking-tight">
              Rask automobilį savo kelionei
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[#8899AA] max-w-xl mx-auto">
              Naršyk automobilius ir palygink kainas pagal kuro tipą ir kėbulo klasę - be registracijos ir be
              paslėptų mokesčių. Rezervuok internetu per kelias minutes, kai surasi tinkamą automobilį.
            </p>

            <SearchForm value={search} onChange={setSearch} onSubmit={handleSearch} variant="hero" />
          </div>
        </section>

        {/* Trumpa juosta su faktais vietoj ilgų pastraipų */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col divide-y divide-[#1C2B3A] sm:flex-row sm:divide-x sm:divide-y-0 rounded-2xl border border-[#1C2B3A] bg-[#0E1525]/60">
            {[
              { value: "10", label: "miestų Lietuvoje" },
              { value: "70", label: "automobilių parke" },
              { value: "0 €", label: "registracijos mokestis" },
              { value: "~5 min", label: "iki tinkamo automobilio" },
            ].map((f) => (
              <div key={f.label} className="flex-1 px-6 py-5 text-center">
                <p className="text-2xl font-bold text-[#F7F7F7]">{f.value}</p>
                <p className="text-xs text-[#8899AA] mt-1">{f.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-[#8899AA] max-w-2xl mx-auto">
            AutoRent leidžia palyginti kainas, kėbulo tipus ir kuro rūšis internetu, be registracijos ir be paslėptų
            mokesčių. Rezervacijos patvirtinimas internetu, nuomų istorija ir lojalumo progreso sekimas pasiekiami
            susikūrus nemokamą paskyrą.
          </p>
        </section>

        {/* Automobilių markės */}
        <section id="markes" className="border-y border-[#1C2B3A] bg-[#060A14]/60 py-10 overflow-hidden">
          <p className="text-center text-xs uppercase tracking-widest text-[#3D4F63] mb-6">
            Automobiliai iš populiariausių gamintojų
          </p>
          <BrandLogos />
        </section>

        {/* Automobilių tipai - nuotraukos */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">
            Automobilių tipai mūsų parke
          </h2>
          <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
            Nuo taupių miesto automobilių iki sportinių modelių: pasirink pagal kelionės tikslą, ne tik kainą.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[150px] sm:auto-rows-[190px] gap-4">
            {fleetPhotos.map((f, i) => (
              <Link
                href={f.href}
                key={f.title}
                className={`group relative overflow-hidden rounded-xl border border-[#1C2B3A] hover:border-[#0F597B]/50 transition ${
                  i === 0 ? "col-span-2 row-span-2" : ""
                }`}
              >
                <Image
                  src={f.src}
                  alt={f.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B121F] via-[#0B121F]/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <h3 className="text-[#F7F7F7] font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{f.title}</h3>
                  <p className={`text-[11px] sm:text-xs text-[#C5CEDA] leading-relaxed ${i === 0 ? "" : "hidden sm:block"}`}>
                    {f.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-[#3D4F63]">Iliustracinės nuotraukos.</p>
        </section>

        {/* Kaip veikia */}
        <section id="kaip-veikia" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">Kaip veikia</h2>
          <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
            Trys žingsniai nuo paieškos iki kelio, be nereikalingo popierizmo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6">
                <div className="w-9 h-9 rounded-full bg-[#0F597B]/20 border border-[#0F597B]/30 text-[#4BAFD4] flex items-center justify-center text-sm font-semibold mb-4">
                  {i + 1}
                </div>
                <h3 className="text-[#F7F7F7] font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-[#8899AA] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Kodėl rinktis AutoRent */}
        <section className="relative overflow-hidden border-y border-[#1C2B3A] bg-[#060A14]">
          <Image
            src={stripes}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -left-16 bottom-0 w-56 opacity-[0.07]"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#1C2B3A] order-2 lg:order-1">
                <Image
                  src="/images/fleet/grey-sports-car.jpg"
                  alt="AutoRent automobilis"
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>

              <div className="order-1 lg:order-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] mb-3">Kodėl rinktis AutoRent</h2>
                <p className="text-[#8899AA] mb-8 max-w-lg">
                  Šeši dalykai, kurie skiria patogią automobilio nuomą nuo įprastos.
                </p>
                <ul className="space-y-5">
                  {whyUs.map((w) => (
                    <li key={w.title} className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F597B]/15 border border-[#0F597B]/30 text-[#4BAFD4]">
                        <w.icon className="text-base" />
                      </span>
                      <div>
                        <h3 className="text-[#F7F7F7] font-semibold text-sm">{w.title}</h3>
                        <p className="text-sm text-[#8899AA] leading-relaxed">{w.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Akcijos / pasiūlymai */}
        <section id="akcijos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-center gap-2 justify-center mb-3">
            <FiTag className="text-[#4BAFD4]" />
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center">Kainos pagal kuro tipą</h2>
          </div>
          <p className="text-center text-[#8899AA] max-w-xl mx-auto mb-12">
            Žemiausia kaina kiekvienoje kategorijoje, pagal šiandienos AutoRent automobilių parką.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {deals.map((d) => (
              <div
                key={d.label}
                className="group relative overflow-hidden rounded-xl border border-[#1C2B3A] hover:border-[#0F597B]/40 hover:-translate-y-1 transition"
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={d.photo}
                    alt={d.label}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B121F] via-[#0B121F]/60 to-transparent" />
                </div>
                <span className="absolute top-3 left-3 rounded-full bg-[#0B121F]/80 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#4BAFD4] border border-[#0F597B]/30">
                  {d.tag}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="text-[#F7F7F7] font-semibold mb-1">{d.label}</h3>
                  <p className="text-sm text-[#C5CEDA] mb-1.5">
                    nuo <span className="text-[#F7F7F7] font-semibold">{d.from} €</span> / parai
                  </p>
                  <p className="text-xs text-[#8899AA] leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Statistika / AutoRent naujienos */}
        <section id="statistika" className="relative overflow-hidden border-y border-[#1C2B3A] bg-[#060A14] py-16">
          <Image
            src={dotsBg}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -left-14 -bottom-14 w-72 opacity-[0.12]"
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">
              AutoRent parkas skaičiais
            </h2>
            <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
              Realūs šiandienos AutoRent automobilių parko duomenys, ne rinkos vidurkiai, o tikras mūsų flotilės
              vaizdas šiai dienai. Skaičiai augs kartu su parku.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center transition hover:border-[#0F597B]/40 hover:-translate-y-0.5">
                <FiTruck className="text-2xl text-[#4BAFD4] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#F7F7F7]">70</p>
                <p className="text-xs text-[#8899AA] mt-1">automobilių parke</p>
              </div>
              <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center transition hover:border-[#0F597B]/40 hover:-translate-y-0.5">
                <FiMapPin className="text-2xl text-[#4BAFD4] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#F7F7F7]">10</p>
                <p className="text-xs text-[#8899AA] mt-1">miestų Lietuvoje</p>
              </div>
              <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center transition hover:border-[#0F597B]/40 hover:-translate-y-0.5">
                <FiDollarSign className="text-2xl text-[#4BAFD4] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#F7F7F7]">30-100 €</p>
                <p className="text-xs text-[#8899AA] mt-1">kainų intervalas / parai</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BarChartBox
                title="Vidutinė kaina pagal kuro tipą (€/parai)"
                data={priceByFuel}
                valueLabel="€/parai"
                barColor="#0F597B"
              />
              <PieChartBox
                title="Automobilių pasiskirstymas pagal kėbulo tipą"
                data={carsByBody}
                valueLabel="Automobilių skaičius"
              />
            </div>
          </div>
        </section>

        {/* Lojalumo programos anonsas */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
            <FiAward className="text-5xl text-[#4BAFD4] shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#F7F7F7] mb-2">Lojalumo programa</h3>
              <p className="text-sm text-[#8899AA] leading-relaxed max-w-2xl">
                Kiekviena užbaigta nuoma priartina prie atlygio. Sek savo kelią profilyje ir pasinaudok atlygiu
                kitai nuomai. Kuo daugiau keliauji su AutoRent, tuo daugiau sutaupai.
              </p>
            </div>
            <Link
              href="/paskyra"
              className="shrink-0 bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition whitespace-nowrap"
            >
              Prisijungti / Registruotis
            </Link>
          </div>
        </section>

        {/* DUK */}
        <section id="duk" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">
            Dažniausiai užduodami klausimai
          </h2>
          <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
            Neradai atsakymo?{" "}
            <Link href="/kontaktai" className="text-[#4BAFD4] hover:underline">
              Susisiek su mumis
            </Link>
            .
          </p>
          <div className="space-y-3">
            {faqs.map((f) => (
              <FaqItem key={f.q} question={f.q} answer={f.a} />
            ))}
          </div>
        </section>

        {/* Vietos */}
        <section id="vietos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-center gap-2 justify-center mb-3">
            <FiClock className="text-[#4BAFD4]" />
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center">Kur mus rasti</h2>
          </div>
          <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
            Automobilius galima atsiimti ir grąžinti bet kuriame iš mūsų dešimties padalinių visoje Lietuvoje, nuo
            didžiųjų miestų iki mažesnių regioninių centrų.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {locations.map((loc) => (
              <a
                key={loc.name}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={loc.address}
                className="group flex items-center gap-2 bg-[#0E1525] border border-[#1C2B3A] rounded-lg px-4 py-3 hover:border-[#0F597B]/40 hover:bg-[#0F597B]/10 transition"
              >
                <FiMapPin className="text-[#4BAFD4] shrink-0" />
                <span>
                  <span className="block text-sm text-[#F7F7F7]">{loc.name}</span>
                  <span className="block text-[11px] text-[#3D4F63] group-hover:text-[#8899AA] transition">
                    {loc.address}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

      </main>

      <PublicFooter />
      </div>
    </div>
  );
}
