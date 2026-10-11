"use client";
import { useEffect, useState } from "react";
import BaseModal from "@/app/components/BaseModal";

// Vieno lauko aprašas - naudojamas IR peržiūros, IR redagavimo režimui (žr. renderFieldView/renderFieldEdit žemiau), kad abu režimai liktų suderinti tarpusavyje be dviejų atskirų konfigūracijų.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FieldConfig<T extends Record<string, any>> {
  name?: keyof T & string;
  label: string;
  type?:
    | "text"
    | "number"
    | "select"
    | "textarea"
    | "autocomplete"
    | "password"
    | "date";
  options?: { value: string | number | boolean; label: string }[];
  required?: boolean;
  // Rodomas VISADA (ir peržiūroje, ir redaguojant) kaip statinis tekstas, niekada kaip įvedimo laukas - žr. renderFieldEdit, kuris tokiam laukui tiesiog pakviečia renderFieldView.
  readonly?: boolean;
  render?: (data: T) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EntityModalProps<T extends Record<string, any>> {
  title: string;
  entity: T;
  isOpen: boolean;
  onClose: () => void;
  // Gali GRĄŽINTI Promise (dauguma puslapių naudoja "async (updated) => {...}") - "void" ČIA nereiškia, kad grąžinama reikšmė ignoruojama, TypeScript leidžia Promise<void> funkcijai atitikti "void" tipą; commit() žemiau VISADA "await" šio rezultato, tad grąžintas Promise realiai palaukiamas.
  onSave?: (updated: T) => void | Promise<void>;
  fields: FieldConfig<T>[];
  startInEdit?: boolean;
  noCancel?: boolean;
  extraData?: {
    cars?: Record<string, unknown>[];
  };
  // Papildomas, VISIŠKAI nebūtinas turinys redagavimo rėžime (pvz. pasirinkto
  // automobilio foto/kaina/vieta) - niekam, kas šito nenaudoja, poveikio nėra.
  renderExtra?: (form: T) => React.ReactNode;
}

// Vienas BENDRAS modalas peržiūrai IR redagavimui (žr. "isEditing" žemiau) - naudojamas tiesiogiai KIEKVIENO sąrašo puslapio (klientai/darbuotojai/automobiliai/užsakymai/rezervacijos) "peržiūrėti"/"redaguoti" veiksmams, IR per CreateEntityButton.tsx kūrimo formoms (jis tiesiog apgaubia ŠITĄ komponentą su startInEdit=true).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EntityModal<T extends Record<string, any>>({
  title,
  entity,
  isOpen,
  onClose,
  onSave,
  fields,
  noCancel,
  startInEdit = false,
  extraData,
  renderExtra,
}: EntityModalProps<T>) {
  const [form, setForm] = useState<T>(entity);
  const [isEditing, setIsEditing] = useState(startInEdit);
  // Klaida iš PASKUTINIO "onSave" bandymo - rodoma šalia "Išsaugoti" mygtuko, kol vartotojas arba pataiso duomenis ir bando iš naujo, arba atšaukia; NIEKADA tiesiogiai iš "onSave" - jis gali tik ją MESTI (throw), šis state yra VIENINTELĖ vieta, kuri ją sugauna.
  const [saveError, setSaveError] = useState<string | null>(null);
  // Formą atstato į pradinę "entity" reikšmę, kai modalas ATSIDAROMA arba kai pati "entity" pasikeičia (pvz. pasirinkus KITĄ sąrašo eilutę) - kitaip modalas rodytų PRAĖJUSIO atidarymo liekanas.
  useEffect(() => {
    if (!isOpen) return;
    setForm(entity);
    setIsEditing(startInEdit);
    setSaveError(null);
  }, [entity, startInEdit, isOpen]);

  // automatiškai skaičiuoja bendra_kaina pagal pasirinktą automobilį ir datas
  useEffect(() => {
    if (!extraData?.cars?.length) return;
    if (!isEditing) return;
    const automId = Number((form as Record<string, unknown>).automobilio_id);
    const car = extraData?.cars?.find((c) => c.automobilio_id === automId);
    const start = new Date(String((form as Record<string, unknown>).nuomos_data ?? ""));
    const end = new Date(String((form as Record<string, unknown>).grazinimo_data ?? ""));
    if (car && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffDays = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      );
      const total = diffDays * Number(car.kaina_parai);

      if ((form as Record<string, unknown>).bendra_kaina !== total) {
        setForm((prev) => ({ ...prev, bendra_kaina: total }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.automobilio_id, form.nuomos_data, form.grazinimo_data, extraData?.cars, isEditing]);

  // Vienas pakeitimų tvarkytojas VISIEMS laukų tipams - kiekviena šaka konvertuoja naršyklės VISADA-string reikšmę į tinkamą TIPĄ (skaičius/boolean/data), kad "form" state atitiktų realų backend lauko tipą, ne vien tekstą.
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    const cfg = fields.find((f) => f.name === name);

    if (cfg?.type === "autocomplete" && cfg.options) {
      const match = cfg.options.find((o) => o.label === value);
      setForm((prev) => ({
        ...prev,
        [name]: match ? Number(match.value) : prev[name],
      }));
    } else if (cfg?.type === "number") {
      setForm((prev) => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
    } else if (cfg?.type === "select" && cfg.options) {
      const matched = cfg.options.find((o) => String(o.value) === value);
      const coerced =
        matched !== undefined &&
        (typeof matched.value === "boolean" || typeof matched.value === "number")
          ? matched.value
          : value;
      setForm((prev) => ({ ...prev, [name]: coerced }));
    } else if (cfg?.type === "date") {
      if (value) {
        const d = new Date(value);
        const iso = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : value;
        setForm((prev) => ({ ...prev, [name]: iso }));
      } else {
        setForm((prev) => ({ ...prev, [name]: "" }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // "onSave" bandymas APGAUBTAS try/catch - be šito modalas užsidarytų NET kai išsaugojimas realiai nepavyko (nes "onClose()" žemiau būtų pasiekiamas visada, nepriklausomai nuo onSave rezultato), prarandant vartotojo įvestus duomenis be jokio paaiškinimo.
  const commit = async () => {
    const missing = fields
      .filter((f) => {
        if (!f.required || !f.name) return false;
        const val = form[f.name];
        if (typeof val === "boolean") return false;
        if (typeof val === "number") return isNaN(val);
        return val === null || val === undefined || val === "" ||
          (typeof val === "string" && val.trim() === "");
      })
      .map((f) => `„${f.label}"`);

    if (missing.length > 0) {
      alert(`Privalomi laukai: ${missing.join(", ")}`);
      return;
    }
    setSaveError(null);
    try {
      if (onSave) await onSave(form);
      setIsEditing(false);
      onClose();
    } catch (err) {
      // Modalas SĄMONINGAI NEUŽSIDARO čia - vartotojas turi galimybę pataisyti duomenis ir bandyti iš naujo, neprarandant to, ką jau įvedė.
      setSaveError(err instanceof Error ? err.message : "Nepavyko išsaugoti.");
    }
  };

  // Vieno lauko statinis (NE redaguojamas) atvaizdavimas - naudojamas PERŽIŪROS režimui, IR bet kuriam "readonly: true" laukui net redagavimo režime (žr. renderFieldEdit žemiau).
  const renderFieldView = (cfg: FieldConfig<T>) => {
    if (cfg.render) {
      return (
        <div key={cfg.label} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{cfg.label}</span>
          <span className="text-sm break-all text-[#F7F7F7]">
            {cfg.render(form)}
          </span>
        </div>
      );
    }

    const raw = cfg.name ? entity[cfg.name] : "";
    let display: string;
    if (typeof raw === "boolean") {
      display = raw ? "Taip" : "Ne";
    } else if (cfg.type === "select" && cfg.options) {
      const match = cfg.options.find((o) => String(o.value) === String(raw));
      display = match ? match.label : String(raw ?? "—");
    } else {
      display = String(raw ?? "—");
    }

    return (
      <div key={cfg.name} className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">{cfg.label}</span>
        <span className="text-sm break-all text-[#F7F7F7]">{display}</span>
      </div>
    );
  };

  // Vieno lauko REDAGUOJAMAS atvaizdavimas (tikras input/select/textarea) - "readonly" laukai čia IŠKART perduodami renderFieldView'ui, niekada negauna įvedimo elemento.
  const renderFieldEdit = (cfg: FieldConfig<T>) => {
    if (cfg.readonly) {
      return renderFieldView(cfg);
    }

    const rawValue = cfg.name ? String((form as Record<string, unknown>)[cfg.name] ?? "") : "";
    const common = {
      name: cfg.name,
      value: cfg.type === "date" ? rawValue.slice(0, 10) : rawValue,
      onChange: handleChange,
      className:
        "border border-[#1C2B3A] bg-[#1A2238] text-[#F7F7F7] px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:border-[#0F597B] focus:ring-1 focus:ring-[#0F597B]/50 placeholder-[#3D4F63] transition",
    } as const;

    let input: React.ReactElement;
    switch (cfg.type) {
      case "textarea":
        input = <textarea rows={3} {...common} />;
        break;
      case "select":
        input = (
          <select {...common}>
            <option value="" disabled hidden>
              — Pasirinkite —
            </option>
            {cfg.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        );
        break;
      case "autocomplete":
        input = (
          <>
            <input type="text" list={`${cfg.name}-list`} {...common} />
            <datalist id={`${cfg.name}-list`}>
              {cfg.options?.map((o) => (
                <option key={String(o.value)} value={o.label} />
              ))}
            </datalist>
          </>
        );
        break;
      case "number":
        input = <input type="number" {...common} />;
        break;
      case "date":
        input = <input type="date" {...common} />;
        break;
      case "password":
        input = <input type="password" {...common} />;
        break;
      default:
        input = <input type="text" {...common} />;
    }

    return (
      <div key={cfg.name ?? cfg.label} className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#F7F7F7]">
          {cfg.label}
          {cfg.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {input}
      </div>
    );
  };

  // Laukų tinklelis - ARBA "Redaguoti" arba "Peržiūrėti" versija per kiekvieną lauką, žr. "isEditing ? ... : ..." žemiau.
  const body = (
    <div className="py-2 text-[#F7F7F7]">
      {isEditing && renderExtra && <div className="mb-4">{renderExtra(form)}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((cfg) =>
          isEditing ? renderFieldEdit(cfg) : renderFieldView(cfg)
        )}
      </div>
      {isEditing && saveError && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-red-400">{saveError}</p>
      )}
    </div>
  );

  // Apatiniai mygtukai priklauso nuo režimo IR nuo to, ar "onSave" iš viso perduotas - be onSave (vien peržiūros atvejis, žr. invoices/page.tsx) nerodomas NEI "Redaguoti", NEI "Išsaugoti"/"Atšaukti".
  const actions = isEditing ? (
    <>
      {!noCancel && (
        <button
          onClick={() => { setIsEditing(false); setForm(entity); setSaveError(null); }}
          className="px-3 py-2 rounded-lg text-sm bg-[#1A2238] border border-[#1C2B3A] text-[#8899AA] hover:text-[#F7F7F7] transition"
        >
          Atšaukti
        </button>
      )}
      {onSave && (
        <button
          onClick={commit}
          className="px-4 py-2 rounded-lg text-sm bg-[#0F597B] text-white font-medium hover:bg-[#0C4A66] transition"
        >
          Išsaugoti
        </button>
      )}
    </>
  ) : (
    onSave && (
      <button
        onClick={() => setIsEditing(true)}
        className="px-4 py-2 rounded-lg text-sm bg-[#0F597B] text-white font-medium hover:bg-[#0C4A66] transition"
      >
        Redaguoti
      </button>
    )
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false);
        onClose();
      }}
      title={title}
      actions={actions}
    >
      {body}
    </BaseModal>
  );
}
