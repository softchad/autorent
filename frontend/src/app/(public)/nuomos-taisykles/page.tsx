import type { Metadata } from "next";
import PublicPageShell from "@/app/components/public/PublicPageShell";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Nuomos taisyklės: AutoRent",
  description: "Bendra AutoRent automobilių nuomos sąlygų apžvalga: amžius, dokumentai, kuro politika, atšaukimas.",
};

// Statinis, informacinis sąlygų sąrašas - amžiaus/dokumentų patikra (1-2 skyriai) vyksta RANKINIU BŪDU darbuotojo atsiėmimo metu (žr. 2 skyrių), sistema to skaitmeniškai NEvalidavo registracijos metu.
const sections = [
  {
    title: "1. Kas gali nuomotis automobilį",
    body: "Vairuotojas turi būti sulaukęs bent 18 metų ir turėti galiojantį vairuotojo pažymėjimą. Kai kurioms transporto priemonių kategorijoms gali būti taikomi papildomi amžiaus ar vairavimo stažo reikalavimai.",
  },
  {
    title: "2. Reikalingi dokumentai",
    body: "Atsiimant automobilį reikės galiojančio asmens tapatybės dokumento ir vairuotojo pažymėjimo. Rekomenduojama turėti ir rezervacijos patvirtinimą, kad paėmimas vyktų greičiau.",
  },
  {
    title: "3. Kaina ir mokėjimas",
    body: "Nuomos kaina priklauso nuo kuro tipo, kėbulo klasės, nuomos trukmės ir sezono. Galutinė kaina rodoma prieš patvirtinant rezervaciją, be paslėptų priedų.",
  },
  {
    title: "4. Kuro politika",
    body: "Automobilis perduodamas ir turi būti grąžinamas su tokiu pačiu kuro kiekiu, koks buvo nurodytas perdavimo metu.",
  },
  {
    title: "5. Atšaukimas ir pakeitimai",
    body: "Rezervaciją galima atšaukti arba pakeisti prieš sutartą paėmimo laiką. Konkrečios sąlygos priklauso nuo pasirinkto automobilio ir nurodomos rezervacijos patvirtinime.",
  },
  {
    title: "6. Grąžinimas kitame mieste",
    body: "Priklausomai nuo padalinio ir automobilio, grąžinimas kitame mieste nei buvo paimtas gali būti galimas. Šią informaciją reikia patikrinti prie konkretaus automobilio rezervacijos metu.",
  },
  {
    title: "7. Draudimas",
    body: "Pagrindinis draudimas įtraukiamas į nuomos kainą. Papildomas apsaugos lygis gali būti pasirenkamas atskirai.",
  },
];

// Grynai statinis turinys - renderina "sections" sąrašą aukščiau, be jokių API kvietimų.
export default function RentalTermsPage() {
  return (
    <PublicPageShell>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-3">Nuomos taisyklės</h1>
        <p className="text-[#8899AA] mb-10">
          Bendra AutoRent automobilių nuomos sąlygų apžvalga. Tai informacinis santraukos puslapis, ne teisiškai
          įpareigojantis dokumentas; konkrečios sąlygos gali skirtis priklausomai nuo pasirinkto automobilio ir
          padalinio.
        </p>
        <div className="space-y-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold text-[#F7F7F7] mb-2">{s.title}</h2>
              <p className="text-sm text-[#8899AA] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
