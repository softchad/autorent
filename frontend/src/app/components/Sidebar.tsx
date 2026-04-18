"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import LogoutButton from "./LogoutButton";
import Image from "next/image";
import {
  FiHome, FiTruck, FiCalendar, FiClipboard,
  FiUsers, FiHelpCircle, FiFileText, FiBriefcase, FiUser,
} from "react-icons/fi";
const image = require("@/assets/autorenttextLOGO.png");

const menu = [
  { label: "Dashboard",          href: "/",            icon: FiHome },
  { label: "Automobiliai",       href: "/cars",        icon: FiTruck },
  { label: "Rezervacijos",       href: "/reservations",icon: FiCalendar },
  { label: "Užsakymai",          href: "/orders",      icon: FiClipboard },
  { label: "Klientai",           href: "/clients",     icon: FiUsers },
  { label: "Pagalbos užklausos", href: "/support",     icon: FiHelpCircle },
  { label: "Sąskaitos",          href: "/invoices",    icon: FiFileText },
  { label: "Darbuotojai",        href: "/employees",   icon: FiBriefcase },
  { label: "Profilis",           href: "/profile",     icon: FiUser },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-[#080617] border-r border-[#1C2B3A] flex flex-col min-h-screen z-10">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#1C2B3A]">
        <Image src={image} alt="AutoRent" width={130} height={28} className="select-none" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {menu.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active
                  ? "bg-[#0F597B]/20 text-[#4BAFD4] border border-[#0F597B]/30"
                  : "text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7]"
              )}
            >
              <Icon
                className={clsx(
                  "text-base shrink-0 transition-colors",
                  active ? "text-[#4BAFD4]" : "text-[#3D4F63] group-hover:text-[#8899AA]"
                )}
              />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4BAFD4]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-[#1C2B3A] pt-3">
        <LogoutButton />
        <p className="text-center text-xs text-[#3D4F63] mt-3">
          © {new Date().getFullYear()} AutoRent
        </p>
      </div>
    </aside>
  );
}
