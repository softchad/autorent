"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  FiMenu,
  FiX,
  FiBriefcase,
  FiHome,
  FiTruck,
  FiMapPin,
  FiPhone,
} from "react-icons/fi";
import { FaRoad } from "react-icons/fa6";
import logo from "@/assets/autorenttextLOGO.png";
import SearchForm, { SearchValue } from "./SearchForm";
import SignInModal from "./SignInModal";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";

// Tik realūs, atskiri puslapiai - jokių scroll-to-section nuorodų tame pačiame
// puslapyje. Anksčiau čia buvo visada matoma šoninė juosta su scroll-spy logika
// (žr. git istoriją PublicSidebar.tsx), kas kėlė nuolatinių riktų su highlight'inimu
// ir nepatikimu scroll'inimu iš kito puslapio - supaprastinta pagal KAYAK pavyzdį:
// ramus puslapis be nuolatinio sidebar, hamburger atidaro overlay su tikrais keliais.
const NAV_ITEMS = [
  { label: "Pradžia", href: "/", icon: FiHome },
  { label: "Automobiliai", href: "/automobiliai", icon: FiTruck },
  { label: "Kelionių patarimai", href: "/kelioniu-patarimai", icon: FaRoad },
  { label: "Apie mus", href: "/apie-mus", icon: FiMapPin },
  { label: "Kontaktai", href: "/kontaktai", icon: FiPhone },
];

type PublicHeaderProps = {
  searchValue: SearchValue;
  onSearchChange: (value: SearchValue) => void;
  onSearchSubmit: () => void;
};

export default function PublicHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: PublicHeaderProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { customer } = useCustomerAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pradiniame puslapyje didelė paieškos forma yra per vidurį (hero) - kompaktiška
  // versija header'e pasirodo tik perscrollinus ją. Visuose kituose puslapiuose didelės
  // formos nėra, tad kompaktiška visada matoma iš karto.
  const showCompactSearch = !isHome || scrolled;

  // Uždaro overlay meniu Escape klavišu ir užrakina puslapio scroll'inimą, kol jis atviras.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [navOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#1C2B3A] bg-[#0E0B1F]/85 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="shrink-0 rounded-lg p-1.5 text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
              aria-label="Atidaryti meniu"
              aria-expanded={navOpen}
            >
              <FiMenu className="text-xl" />
            </button>

            <Link href="/" className="shrink-0">
              <Image src={logo} alt="AutoRent" width={130} height={15} className="select-none" />
            </Link>
          </div>

          {/* min-w-0 BŪTINA - be jo šis flex-1 elementas "stumia" header'į platesnį nei
              langas, kai atsiranda paieškos forma (flex elementai pagal nutylėjimą turi
              min-width:auto, kuris leidžia jiems išsiplėsti per turinio dydį). max-w-xl
              apriboja pačios formos plotį, kad ji visada tilptų į tą pačią juostą,
              nepriklausomai nuo to, ar rodoma. */}
          <div
            className={`hidden min-w-0 flex-1 items-center justify-center overflow-hidden transition-all duration-300 ease-out md:flex ${
              showCompactSearch ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="w-full max-w-xl">
              <SearchForm
                value={searchValue}
                onChange={onSearchChange}
                onSubmit={onSearchSubmit}
                variant="compact"
              />
            </div>
          </div>

          {customer ? (
            <Link
              href="/paskyra"
              className="shrink-0 flex items-center gap-2 bg-[#1A2238] hover:bg-[#1E2A47] border border-[#1C2B3A] text-[#F7F7F7] text-sm font-medium pl-2 pr-4 py-1.5 rounded-full transition"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F597B] text-xs font-semibold text-white">
                {customer.vardas[0]?.toUpperCase()}
              </span>
              {customer.vardas}
            </Link>
          ) : (
            <button
              onClick={() => setSignInOpen(true)}
              className="shrink-0 bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Prisijungti
            </button>
          )}
        </div>
      </header>

      {/* Visą puslapį patamsinantis overlay meniu - ne nuolat matoma šoninė juosta.
          Tik tikri, atskiri puslapiai (žr. NAV_ITEMS aukščiau), jokio scroll-spy.
          Visada sumontuotas DOM'e (ne {navOpen && ...}), kad transform/opacity pereitų
          sklandžiai - sąlyginis mount/unmount reikštų, kad nėra ką animuoti uždarant. */}
      <div
        className={`fixed inset-0 z-[2000] flex transition-opacity duration-300 ease-out ${
          navOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* z-[2000] visam overlay - Leaflet žemėlapio (naudojamo /automobiliai) vidiniai
            sluoksniai (markeriai/popup/kontrolės) patys siekia iki z-index:1000. */}
        <div
          className="absolute inset-0 bg-[#000000]/70 backdrop-blur-sm"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
        <nav
          className={`relative flex h-full w-full max-w-xs flex-col bg-[#080617] border-r border-[#1C2B3A] shadow-2xl transition-transform duration-300 ease-out ${
            navOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <Image src={logo} alt="AutoRent" width={130} height={15} className="select-none" />
            <button
              onClick={() => setNavOpen(false)}
              className="rounded-lg p-1.5 text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
              aria-label="Uždaryti meniu"
            >
              <FiX className="text-xl" />
            </button>
          </div>
          <div className="mx-5 h-px bg-[#1C2B3A]" />

          <ul className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setNavOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-[#C5CEDA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
                >
                  <Icon className="shrink-0 text-lg text-[#4BAFD4]" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-[#1C2B3A] px-3 py-4">
            <Link
              href="/login"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
            >
              <FiBriefcase className="shrink-0 text-lg" />
              Prisijungimas darbuotojams
            </Link>
          </div>
        </nav>
      </div>

      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
