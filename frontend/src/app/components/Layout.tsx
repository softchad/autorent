"use client";

import { useAppSelector } from "@/store/hooks";
import Sidebar from "./Sidebar";
import Image from "next/image";
import { usePathname } from "next/navigation";

import image from "@/assets/logo-mark.png";
import image2 from "@/assets/texture-dots.png";
import { isPublicPath } from "@/utils/publicRoutes";

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const pathname = usePathname();

  // Viešos svetainės puslapiai ir prisijungimo puslapis turi savo pilną maketą -
  // be darbuotojų Sidebar, watermark ar main paddingo.
  const isFullBleed = isPublicPath(pathname ?? "") || pathname === "/login";
  if (isFullBleed) {
    return <div className="min-h-screen bg-[#0B121F]">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#0E0B1F] overflow-hidden relative">
      {token && <Sidebar />}

      {/* Watermark */}
      <div className="pointer-events-none absolute inset-0 flex justify-center items-center z-0 opacity-3">
        <Image
          src={image}
          alt="Watermark"
          width={1200}
          height={1200}
          className=" select-none"
        />
      </div>
      <div className="pointer-events-none absolute bottom-[-100px] right-[-100px] z-0 opacity-55">
        <Image src={image2} alt="Watermark" width={600} height={600} />
      </div>

      <div className="pointer-events-none absolute top-[-100px] left-[-100px] z-0 opacity-35">
        <Image src={image2} alt="Watermark" width={600} height={600} />
      </div>
      <main className="flex-1 min-w-0 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
