"use client";

import { useState } from "react";
import EntityModal, { FieldConfig } from "./modals/EntityModal";

export type { FieldConfig };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props<T extends Record<string, any>> = {
  buttonLabel: string;
  modalTitle: string;
  fields: FieldConfig<T>[];
  onCreate: (newData: Omit<T, "id" | `${string}_id`>) => Promise<void>;
  initial?: Partial<T>;
  extraData?: {
    cars?: Record<string, unknown>[];
  };
};

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
          onSave={async (created) => {
            await onCreate(created as Omit<T, "id" | `${string}_id`>);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
