"use client";

import Link from "next/link";
import Image from "next/image";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import { FaFacebook, FaXTwitter, FaYoutube, FaInstagram } from "react-icons/fa6";
import logo from "@/assets/logo-full.png";

const companyLinks = [
  { label: "Apie mus", href: "/apie-mus" },
  { label: "Karjera", href: "/karjera" },
  { label: "Nuomos taisyklės", href: "/nuomos-taisykles" },
  { label: "Privatumo politika", href: "/privatumo-politika" },
];

const carsLinks = [
  { label: "Visi automobiliai", href: "/automobiliai" },
  { label: "Vilniuje", href: "/automobiliai?location=Vilnius" },
  { label: "Kaune", href: "/automobiliai?location=Kaunas" },
  { label: "Klaipėdoje", href: "/automobiliai?location=Klaip%C4%97da" },
  { label: "Dažni klausimai", href: "/#duk" },
];

const COMPANY_ADDRESS = "Gedimino pr. 1, Vilnius";
const COMPANY_PHONE = "+37060000000";
const COMPANY_PHONE_DISPLAY = "+370 600 00000";
const COMPANY_EMAIL = "info@autorent.lt";

const socialIcons = [FaFacebook, FaXTwitter, FaInstagram, FaYoutube];

export default function PublicFooter() {
  return (
    <footer className="border-t border-[#1C2B3A] bg-[#060A14]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image src={logo} alt="AutoRent" width={120} height={14} className="mb-3 select-none" />
            <p className="text-sm text-[#8899AA] leading-relaxed">
              Automobilių nuoma be rūpesčių, nuo paieškos iki grąžinimo.
            </p>
          </div>

          <div>
            <h3 className="text-[#F7F7F7] font-semibold mb-3 text-sm">Įmonė</h3>
            <ul className="space-y-2 text-sm text-[#8899AA]">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-[#4BAFD4] transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[#F7F7F7] font-semibold mb-3 text-sm">Automobiliai</h3>
            <ul className="space-y-2 text-sm text-[#8899AA]">
              {carsLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-[#4BAFD4] transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[#F7F7F7] font-semibold mb-3 text-sm">Kontaktai</h3>
            <ul className="space-y-2 text-sm text-[#8899AA]">
              <li className="flex items-center gap-2">
                <FiMapPin className="shrink-0" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY_ADDRESS)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#4BAFD4] transition"
                >
                  Vilnius Centras, {COMPANY_ADDRESS}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <FiPhone className="shrink-0" />
                <a href={`tel:${COMPANY_PHONE}`} className="hover:text-[#4BAFD4] transition">
                  {COMPANY_PHONE_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <FiMail className="shrink-0" />
                <a href={`mailto:${COMPANY_EMAIL}`} className="hover:text-[#4BAFD4] transition">
                  {COMPANY_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[#1C2B3A] pt-6 flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p className="text-xs text-[#3D4F63]">© {new Date().getFullYear()} AutoRent. Visos teisės saugomos.</p>
            <p className="flex items-center gap-1.5 text-xs text-[#3D4F63]">
              <span className="flex h-3 w-4 flex-col overflow-hidden rounded-[2px]">
                <span className="flex-1 bg-[#FDB913]" />
                <span className="flex-1 bg-[#006A44]" />
                <span className="flex-1 bg-[#C1272D]" />
              </span>
              Sukurta Lietuvoje
            </p>
          </div>

          <div className="flex items-center gap-3">
            {socialIcons.map((Icon, i) => (
              <Link
                key={i}
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1C2B3A] text-[#3D4F63] hover:border-[#0F597B]/50 hover:text-[#4BAFD4] transition"
              >
                <Icon className="text-sm" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
