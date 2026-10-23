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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { id } = await params;
  const carId = Number(id);
  if (!Number.isInteger(carId) || carId <= 0) notFound();
  const dates = await searchParams;
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(dates.dateFrom ?? "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(dates.dateTo ?? "") && dates.dateFrom! < dates.dateTo!;
  return <CarDetailClient id={carId} initialDates={validDates ? { dateFrom: dates.dateFrom!, dateTo: dates.dateTo! } : undefined} />;
}
