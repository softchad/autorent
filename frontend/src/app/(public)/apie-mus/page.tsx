import type { Metadata } from "next";
import Image from "next/image";
import { FiMapPin, FiTruck, FiHeart } from "react-icons/fi";
import PublicPageShell from "@/app/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Apie mus: AutoRent",
  description: "AutoRent misija, komanda ir kodėl automobilių nuomą darome paprastesnę visoje Lietuvoje.",
};

export default function AboutPage() {
  return (
    <PublicPageShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/images/fleet/sedan-highway.jpg" alt="" fill sizes="100vw" className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E0B1F]/60 via-[#0E0B1F] to-[#0E0B1F]" />
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
            AutoRent pradėjome kaip nedidelę automobilių nuomos platformą, kuri kasdien plečiasi. Šiuo metu
            aptarnaujame dešimt miestų visoje Lietuvoje, nuo Vilniaus iki Telšių, o mūsų automobilių parkas auga
            kiekvieną mėnesį.
          </p>
          <p>
            Mūsų tikslas paprastas: leisti žmonėms rasti tinkamą automobilį, pamatyti aiškią kainą ir patvirtinti
            rezervaciją per kelias minutes, tiesiai iš naršyklės. Nesvarbu, ar reikia automobilio vienai dienai
            mieste, ar savaitės kelionei per visą šalį.
          </p>
          <p>
            Dirbame nuolat plėsdami padalinių tinklą ir automobilių pasirinkimą, o kliento savitarnos ir lojalumo
            programos funkcijos šiuo metu yra kuriamos.
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
