"use client";

import { useAppSelector } from "@/store/hooks";
import Sidebar from "./Sidebar";
import Image from "next/image";
import { usePathname } from "next/navigation";

const image = require("@/assets/autorentLOGO.png");
const image2 = require("@/assets/var1.png");

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#0E0B1F] overflow-hidden relative">
      {token && pathname !== "/login" && <Sidebar />}

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
      <main className="flex-1 min-w-0 overflow-x-auto bg-[#0E0B1F] p-6">{children}</main>
    </div>
  );
}
