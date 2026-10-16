import type { Metadata } from "next";
import PublicPageShell from "@/app/components/public/PublicPageShell";
import ContactSection from "@/app/components/public/ContactSection";

// Specialus Next.js eksportas - sistema PATI sudeda šiuos laukus į <head> (title/description) paieškos sistemoms ir nuorodos peržiūrai soc. tinkluose.
export const metadata: Metadata = {
  title: "Kontaktai: AutoRent",
  description: "Susisiek su AutoRent komanda - klientų aptarnavimas per paskyrą, atsiliepimai ir padalinių kontaktai.",
};

// Antraštė čia, pati forma/pokalbių skydelis - ContactSection.tsx; ŠIS komponentas naudoja TĄ PATĮ SupportInbox, kurį rodo ir /paskyra (žr. AccountClient.tsx), tad "atsakymą matysi paskyroje" aukščiau yra TIKRAS teiginys, ne pažadas.
export default function KontaktaiPage() {
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-3xl px-4 pt-12 text-center sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F7F7F7] mb-3">Kontaktai</h1>
        <p className="text-[#8899AA]">
          Klausimai dėl rezervacijos ar nuomos? Parašyk mums žemiau - prisijungęs matysi atsakymą tiesiai savo
          paskyroje.
        </p>
      </div>
      <ContactSection />
    </PublicPageShell>
  );
}
