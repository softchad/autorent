import type { Metadata } from "next";
import AccountClient from "@/app/components/public/AccountClient";

export const metadata: Metadata = {
  title: "Mano paskyra: AutoRent",
  description: "AutoRent kliento paskyros profilis ir nuomų informacija.",
};

export default function PaskyraPage() {
  return <AccountClient />;
}
