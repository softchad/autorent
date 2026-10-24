import type { Metadata } from "next";
import PublicPageShell from "@/app/components/public/PublicPageShell";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Privatumo politika: AutoRent",
  description: "Kokius duomenis AutoRent renka, kam juos naudoja ir kaip su mumis susisiekti dėl duomenų klausimų.",
};

// Privatumo puslapis aprašo paskyrų ir nuomos duomenis; kliento bilietas saugomas localStorage, darbuotojo – localStorage ir slapuke, o išoriniam prisijungimui naudojama OAuth sesija.
const sections = [
  {
    title: "1. Kokius duomenis renkame",
    body: "Kuriant kliento paskyrą ir rezervuojant automobilį renkame vardą, pavardę, el. paštą, telefono numerį ir rezervacijos informaciją (datas, automobilį, padalinį). Mokėjimo duomenys, jei jų prireiks ateityje, būtų tvarkomi per atskirą apsaugotą mokėjimų paslaugą.",
  },
  {
    title: "2. Kam naudojame duomenis",
    body: "Duomenys naudojami rezervacijoms sudaryti ir vykdyti, kliento paskyrai valdyti, lojalumo programos progresui skaičiuoti ir susisiekti su klientu dėl jo rezervacijos.",
  },
  {
    title: "3. Duomenų saugojimas",
    body: "Duomenys saugomi tiek, kiek reikalinga paslaugai teikti ir teisiniams įsipareigojimams įvykdyti. Klientas gali paprašyti savo duomenis ištrinti arba peržiūrėti susisiekęs žemiau nurodytu el. paštu.",
  },
  {
    title: "4. Duomenų perdavimas trečiosioms šalims",
    body: "Duomenų neparduodame. Duomenimis dalinamasi tik su paslaugų teikėjais, būtinais rezervacijai įvykdyti (pavyzdžiui, mokėjimų ar žemėlapių paslaugų teikėjais), ir tik tiek, kiek būtina.",
  },
  {
    title: "5. Slapukai ir naršyklės saugykla",
    body: "Prisijungimo sesijai palaikyti naudojame būtinąją naršyklės saugyklą: darbuotojams - slapuką, klientams - localStorage. Analitikos ar rinkodaros slapukų šiuo metu nenaudojame.",
  },
  {
    title: "6. Kontaktai duomenų klausimais",
    body: "Dėl savo duomenų peržiūros, taisymo ar ištrynimo susisiek el. paštu info@autorent.lt.",
  },
];

// Grynai statinis turinys - renderina "sections" sąrašą aukščiau, be jokių API kvietimų.
export default function PrivacyPolicyPage() {
  return (
    <PublicPageShell>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-3">Privatumo politika</h1>
        <p className="text-[#8899AA] mb-10">
          Supaprastinta apžvalga, kaip AutoRent tvarko asmens duomenis. Sistema šiuo metu tobulinama, todėl ši
          apžvalga bus detalizuojama kartu su kliento savitarnos funkcijomis.
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
