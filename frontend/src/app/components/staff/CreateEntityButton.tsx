"use client";

import { useState } from "react";
import EntityModal, { FieldConfig } from "./EntityModal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props<T extends Record<string, any>> = {
  buttonLabel: string;
  modalTitle: string;
  fields: FieldConfig<T>[];
  // "Partial<T>" (ne "Omit<T, 'id' | `${string}_id`>", kaip buvo anksčiau) - tas Omit raštas pašalindavo IŠ TIPO visus laukus, kurių vardas baigiasi "_id", NE TIK naujo įrašo PATĮ identifikatorių (pvz. automobilio_id kuriant automobilį), bet IR tikrus, REIKALINGUS užsienio raktus (pvz. dabartine_vieta_id automobiliui) - tie laukai realiai siunčiami forma (žr. atitinkamą FieldConfig[] sąrašą), tiesiog TypeScript jų "nematė", versdamas naudoti "as unknown as X" apeinimus kiekviename puslapyje.
  onCreate: (newData: Partial<T>) => Promise<void>;
  initial?: Partial<T>;
  extraData?: {
    cars?: Record<string, unknown>[];
  };
};

// Plonas apvalkalas aplink EntityModal.tsx (startInEdit=true, be "Atšaukti") - PATI kūrimo/klaidų logika (privalomų laukų patikra, onSave try/catch, modalo uždarymas TIK po sėkmės) gyvena EntityModal'e, ne čia.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CreateEntityButton<T extends Record<string, any>>({
  buttonLabel,
  modalTitle,
  fields,
  onCreate,
  initial = {},
  extraData,
}: Props<T>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>

      {open && (
        <EntityModal
          noCancel={true}
          title={modalTitle}
          entity={initial as T}
          fields={fields}
          isOpen={open}
          startInEdit
          extraData={extraData}
          onClose={() => setOpen(false)}
          // "setOpen(false)" ČIA NEBŪTINAS - EntityModal.commit() jį iškviečia PATS ("onClose" aukščiau), bet TIK jei "onCreate" sėkmingai baigiasi (neišmeta klaidos); jei onCreate meta klaidą, EntityModal ją sugauna ir PALIEKA modalą atvirą, kad vartotojas galėtų pataisyti duomenis.
          onSave={async (created) => {
            await onCreate(created);
          }}
        />
      )}
    </>
  );
}
