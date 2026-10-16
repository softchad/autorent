import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CarDetailClient from "@/app/components/public/CarDetailClient";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Automobilio informacija: AutoRent",
  description: "Automobilio specifikacijos, kaina ir paėmimo vieta AutoRent parke.",
};

// "params" ateina kaip Promise (Next.js 15 API, ne pasirinkimas) - "id" iš URL (pvz. /automobiliai/abc) gali būti NE skaičius; CarDetailClient.tsx neturi atskiro render'o bendrai klaidai (tik notFound/isLoading/car šakas), tad be šios patikros vartotojas matytų TUŠČIĄ puslapį, ne 404.
export default async function AutomobilioDetalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carId = Number(id);
  if (!Number.isInteger(carId) || carId <= 0) notFound();
  return <CarDetailClient id={carId} />;
}
