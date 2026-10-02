import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FiCheckCircle, FiExternalLink, FiMapPin } from "react-icons/fi";
import PublicPageShell from "@/app/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Kelionių patarimai: AutoRent",
  description: "Praktiniai patarimai nuomojantis automobilį, miestų gidas ir naudingi straipsniai apie vairavimą Lietuvoje.",
};

// Nuorodos į realius, sąžiningai atributuotus straipsnius kitų šaltinių, ne AutoRent pačios sukurtas "naujienos".
const articles = [
  {
    photo: "/images/fleet/ev-charging.jpg",
    title: "Elektromobilių dalis Europoje toliau auga",
    excerpt:
      "2026 m. pradžioje elektromobiliai sudarė apie 19% naujų automobilių registracijų Europoje, o viešų įkrovimo taškų skaičius viršijo 1,2 mln.",
    source: "International Council on Clean Transportation",
    url: "https://theicct.org/publication/ev-transition-check-2026/",
  },
  {
    photo: "/images/fleet/sedan-highway.jpg",
    title: "Populiariausi automobiliai Lietuvoje",
    excerpt:
      "Naujų automobilių rinkoje dominuoja hibridai, o Toyota RAV4 išlieka perkamiausiu modeliu. Naudotų automobilių rinkoje pirmauja Volkswagen Golf.",
    source: "WheelStreet.lt",
    url: "https://www.wheelstreet.lt/en/straipsniai/91-populiariausi-automobiliai-lietuva-2025",
  },
  {
    photo: "/images/fleet/silver-sports-car.jpg",
    title: "Žiemos vairavimo taisyklės Lietuvoje",
    excerpt:
      "Žieminės padangos privalomos nuo lapkričio 10 d. iki balandžio 1 d., o žiemą greitis greitkeliuose ribojamas iki 110 km/h.",
    source: "RAC Drive",
    url: "https://www.rac.co.uk/drive/travel/country/lithuania/",
  },
];

const tips = [
  "Rezervuok bent 3-5 dienas iš anksto. Dažniausiai paklausiausi automobiliai išnuomojami pirmieji, ypač savaitgaliais ir švenčių metu.",
  "Prieš pasirašydamas sutartį patikrink kuro lygį ir esamus paviršiaus pažeidimus. Nufotografuok automobilį iš visų pusių.",
  "Pasirink paėmimo vietą arčiau savo maršruto pradžios, taip sutaupysi laiko ir nervų atvykimo dieną.",
  "Ilgesnei nei savaitės nuomai dažniausiai apsimoka dyzelinis arba hibridinis variantas dėl mažesnių kuro sąnaudų.",
  "Pasidomėk lojalumo programa: kiekviena užbaigta nuoma artina prie nuolaidos kitai kelionei.",
  "Grąžinimo metu padaryk keletą nuotraukų, tai apsaugo abi puses kilus neaiškumams dėl automobilio būklės.",
  "Patikrink, ar kaina apima antrą vairuotoją, jei kelionėje vairuos ne vienas žmogus.",
  "Planuodamas kelionę į kitą miestą, iš anksto pasidomėk, kuriuose padaliniuose galima grąžinti automobilį.",
];

const cityGuides = [
  {
    city: "Vilnius",
    desc: "Sostinėje automobilis praverčia tiek verslo kelionėms, tiek savaitgalio išvykoms į Trakus ar Aukštaitiją. Vilniaus centro padalinys patogiai pasiekiamas iš oro uosto ir geležinkelio stoties.",
  },
  {
    city: "Kaunas",
    desc: "Laikinojoje sostinėje automobilio nuoma dažnai renkamasi kelionėms link Nemuno kilpų ar Žemaitijos link. Kauno centro padalinys yra netoli senamiesčio.",
  },
  {
    city: "Klaipėda",
    desc: "Uostamiestyje automobilis patogus norintiems aplankyti Kuršių neriją ar pajūrio kurortus. Vasaros sezonu paklausa itin didelė, tad verta rezervuoti iš anksto.",
  },
];

export default function KelioniuPatarimaiPage() {
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-3xl px-4 pt-12 pb-4 text-center sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-3">Kelionių patarimai</h1>
        <p className="text-[#8899AA]">
          Praktiniai patarimai, miestų gidas ir naudingi straipsniai, kad kelionė su nuomotu automobiliu
          praeitų sklandžiai.
        </p>
      </div>

      {/* Patarimai */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">
          Naudingi patarimai nuomojantis automobilį
        </h2>
        <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
          Keletas praktinių pastabų, kurios padės išvengti nemalonių netikėtumų.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tips.map((tip) => (
            <div key={tip} className="flex items-start gap-3 bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-5">
              <FiCheckCircle className="text-[#4BAFD4] shrink-0 mt-0.5" />
              <p className="text-sm text-[#8899AA] leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Miestų gidas */}
      <section className="border-y border-[#1C2B3A] bg-[#060A14] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">
            Automobilių nuoma pagal miestą
          </h2>
          <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
            Kiekvienas miestas turi savo ritmą: štai kur automobilis praverčia labiausiai.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {cityGuides.map((c) => (
              <div
                key={c.city}
                className="bg-[#0E1525] border border-[#1C2B3A] rounded-xl p-6 transition hover:border-[#0F597B]/40 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <FiMapPin className="text-[#4BAFD4]" />
                  <h3 className="text-[#F7F7F7] font-semibold">{c.city}</h3>
                </div>
                <p className="text-sm text-[#8899AA] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Naujienos ir straipsniai */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F7F7] text-center mb-3">Naudinga paskaityti</h2>
        <p className="text-center text-[#8899AA] max-w-2xl mx-auto mb-12">
          Keletas nuorodų į kitų šaltinių straipsnius apie automobilius, elektromobilius ir vairavimą Lietuvoje.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {articles.map((a) => (
            <a
              key={a.title}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-xl border border-[#1C2B3A] bg-[#0E1525] hover:border-[#0F597B]/40 transition"
            >
              <div className="relative aspect-[16/10]">
                <Image
                  src={a.photo}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h3 className="text-[#F7F7F7] font-semibold text-sm mb-2 flex items-start justify-between gap-2">
                  {a.title}
                  <FiExternalLink className="shrink-0 text-[#3D4F63] group-hover:text-[#4BAFD4] transition mt-0.5" />
                </h3>
                <p className="text-xs text-[#8899AA] leading-relaxed mb-3">{a.excerpt}</p>
                <p className="text-[11px] text-[#3D4F63]">Šaltinis: {a.source}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-16 text-center sm:px-6">
        <Link
          href="/automobiliai"
          className="inline-flex items-center gap-2 bg-[#0F597B] hover:bg-[#0C4A66] text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Naršyti automobilius
        </Link>
      </div>
    </PublicPageShell>
  );
}
