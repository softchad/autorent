import type { Metadata } from "next";
import { FiMail, FiUsers } from "react-icons/fi";
import PublicPageShell from "@/app/components/public/PublicPageShell";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Karjera: AutoRent",
  description: "AutoRent komanda auga kartu su padalinių tinklu. Sužinok, kaip susisiekti dėl galimybių.",
};

// Grynai statinis turinys, be jokio laisvų pozicijų sąrašo ar formos - tik nuoroda susisiekti el. paštu, kol tokio sąrašo dar nėra.
export default function CareersPage() {
  return (
    <PublicPageShell>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
        <FiUsers className="text-4xl text-[#4BAFD4] mx-auto mb-6" />
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-4">Karjera AutoRent</h1>
        <p className="text-[#8899AA] text-lg leading-relaxed mb-10">
          Šiuo metu neturime atviro viešo skelbimų sąrašo, tačiau komanda auga kartu su padalinių tinklu. Jei norėtum
          prisidėti prie automobilių nuomos platformos, kuri plečiasi visoje Lietuvoje, parašyk mums.
        </p>
        <a
          href="mailto:info@autorent.lt"
          className="inline-flex items-center gap-2 bg-[#0F597B] hover:bg-[#0C4A66] text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          <FiMail />
          info@autorent.lt
        </a>
      </section>
    </PublicPageShell>
  );
}
