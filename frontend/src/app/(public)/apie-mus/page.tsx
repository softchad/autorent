import type { Metadata } from "next";
import Image from "next/image";
import { FiMapPin, FiTruck, FiHeart } from "react-icons/fi";
import PublicPageShell from "@/app/components/public/PublicPageShell";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Apie mus: AutoRent",
  description: "AutoRent misija, komanda ir kodėl automobilių nuomą darome paprastesnę visoje Lietuvoje.",
};

// Grynai statinis turinys (be API kvietimų) - skaičiai tekste ("10 miestų", "elektromobilių") turi atitikti database/seed.sql Pristatymo_Vietos įrašus ir schemas/car.py VALID_KURO_TIPAS; jiems pasikeitus, šis tekstas taip pat turi būti atnaujintas ranka.
export default function AboutPage() {
  return (
    <PublicPageShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/images/fleet/sedan-highway.jpg" alt="" fill sizes="100vw" className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B121F]/60 via-[#0B121F] to-[#0B121F]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-4">Apie AutoRent</h1>
          <p className="text-[#8899AA] text-lg leading-relaxed">
            Norime, kad automobilio nuoma būtų tokia pat paprasta, kaip užsisakyti taksi. Be eilių, be paslėptų
            mokesčių, be nereikalingo popierizmo.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-6 text-[#8899AA] leading-relaxed">
          <p>
            AutoRent pradėjome kaip nedidelę automobilių nuomos platformą - šiandien aptarnaujame dešimt miestų nuo
            Vilniaus iki Telšių, o automobilių parkas auga kiekvieną mėnesį.
          </p>
          <p>
            Tikslas paprastas: rasti tinkamą automobilį, pamatyti aiškią kainą ir patvirtinti rezervaciją per kelias
            minutes, tiesiai iš naršyklės. Nesvarbu, ar reikia automobilio vienai dienai mieste, ar savaitės
            kelionei per visą šalį.
          </p>
          <p>
            Tinklą ir automobilių pasirinkimą plečiame nuolat, o grįžtantiems klientams - lojalumo programa su
            nuolaidomis ir visa nuomų istorija vienoje paskyroje.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center">
            <FiMapPin className="text-2xl text-[#4BAFD4] mx-auto mb-3" />
            <p className="text-sm text-[#F7F7F7] font-semibold">10 miestų</p>
            <p className="text-xs text-[#8899AA] mt-1">visoje Lietuvoje</p>
          </div>
          <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center">
            <FiTruck className="text-2xl text-[#4BAFD4] mx-auto mb-3" />
            <p className="text-sm text-[#F7F7F7] font-semibold">Auganti flotilė</p>
            <p className="text-xs text-[#8899AA] mt-1">nuo ekonominės iki elektromobilių</p>
          </div>
          <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 text-center">
            <FiHeart className="text-2xl text-[#4BAFD4] mx-auto mb-3" />
            <p className="text-sm text-[#F7F7F7] font-semibold">Skaidrumas</p>
            <p className="text-xs text-[#8899AA] mt-1">be paslėptų mokesčių</p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
