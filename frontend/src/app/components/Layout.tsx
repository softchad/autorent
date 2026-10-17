"use client";

import { useAppSelector } from "@/store/hooks";
import Sidebar from "./staff/Sidebar";
import Image from "next/image";
import { usePathname } from "next/navigation";

import image from "@/assets/logo-mark.png";
import image2 from "@/assets/texture-dots.png";
import { isPublicPath } from "@/utils/publicRoutes";

// Bendras app/layout.tsx karkasas - sprendžia, ar rodyti DARBUOTOJŲ apvalkalą (Sidebar + fono vandens ženklai), ar "pilno ekrano" apvalkalą viešiems/login puslapiams, pagal einamą kelią.
export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const pathname = usePathname();

  // Viešos svetainės puslapiai ir prisijungimo puslapis turi savo pilną maketą - be darbuotojų Sidebar, vandens ženklų ar main paddingo.
  const isFullBleed = isPublicPath(pathname ?? "") || pathname === "/login";
  if (isFullBleed) {
    return <div className="min-h-screen bg-[#0B121F]">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#0E0B1F] overflow-hidden relative">
      {token && <Sidebar />}

      {/* Fono vandens ženklas - centre, didelis, labai permatomas */}
      <div className="pointer-events-none absolute inset-0 flex justify-center items-center z-0 opacity-3">
        <Image
          src={image}
          alt="Vandens ženklas"
          width={1200}
          height={1200}
          className=" select-none"
        />
      </div>
      {/* Antras vandens ženklo logotipas - apatiniame dešiniame kampe, už ekrano ribos (dalis nupjauta) */}
      <div className="pointer-events-none absolute bottom-[-100px] right-[-100px] z-0 opacity-55">
        <Image src={image2} alt="Vandens ženklas" width={600} height={600} />
      </div>

      {/* Trečias vandens ženklo logotipas - viršutiniame kairiame kampe, simetriškai antram */}
      <div className="pointer-events-none absolute top-[-100px] left-[-100px] z-0 opacity-35">
        <Image src={image2} alt="Vandens ženklas" width={600} height={600} />
      </div>
      <main className="flex-1 min-w-0 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
