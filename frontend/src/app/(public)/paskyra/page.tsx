import type { Metadata } from "next";
import { Suspense } from "react";
import AccountClient from "@/app/components/public/AccountClient";

export const metadata: Metadata = {
  title: "Mano paskyra: AutoRent",
  description: "AutoRent kliento paskyros profilis ir nuomų informacija.",
};

export default function PaskyraPage() {
  return (
    <Suspense fallback={null}>
      <AccountClient />
    </Suspense>
  );
}
