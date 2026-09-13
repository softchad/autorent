import type { Metadata } from "next";
import CarDetailClient from "@/app/components/public/CarDetailClient";

export const metadata: Metadata = {
  title: "Automobilio informacija: AutoRent",
  description: "Automobilio specifikacijos, kaina ir paėmimo vieta AutoRent parke.",
};

export default async function AutomobilioDetalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarDetailClient id={Number(id)} />;
}
