"use client";

import { localISO } from "@/utils/formatLt";

import { useMemo, useState } from "react";
import BaseModal from "@/app/components/BaseModal";
import { useCreateInvoiceMutation } from "@/store/autorentApi";
import type { OrderOut, InvoiceOut } from "@/store/autorentApi";
import { formatApiError } from "@/utils/formatApiError";

interface Props {
  orders: OrderOut[];
  invoices: InvoiceOut[];
  getClientName: (id: number) => string;
  getCarName: (id: number) => string;
  onCreated: () => Promise<void> | void;
}

const inputClass =
  "border border-[#1C2B3A] bg-[#1A2238] text-[#F7F7F7] px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:border-[#0F597B] focus:ring-1 focus:ring-[#0F597B]/50 transition";

// Mygtukas + modalas sąskaitos išrašymui - sąrašas rodo TIK užsakymus, kurie DAR NETURI sąskaitos (žr. availableOrders žemiau), kad staff negalėtų bandyti išrašyti dviejų sąskaitų tam pačiam užsakymui iš šio puslapio.
export default function CreateInvoiceButton({
  orders,
  invoices,
  getClientName,
  getCarName,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | "">("");
  const [total, setTotal] = useState<number>(0);
  const [date, setDate] = useState(() => localISO(new Date()));
  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();

  // Užsakymai, kurie DAR NETURI susietos sąskaitos - jau nusąskaitytus praleidžia iš sąrašo.
  const availableOrders = useMemo(
    () => orders.filter((o) => !invoices.some((inv) => inv.order_id === o.uzsakymo_id)),
    [orders, invoices]
  );

  // Atidarant modalą laukai VISADA atstatomi į pradinę būseną - be šito ankstesnio bandymo likučiai (pasirinktas užsakymas/suma) liktų rodomi, net jei tas užsakymas tarp dviejų atidarymų jau nusąskaitytas.
  const handleOpen = () => {
    setOrderId("");
    setTotal(0);
    setDate(localISO(new Date()));
    setOpen(true);
  };

  // Pasirinkus užsakymą, suma IŠ KARTO užpildoma jo bendra_kaina - staff gali ją PATS pakoreguoti žemiau (pvz. nuolaida), tai tik patogus pradinis pasiūlymas, ne fiksuota reikšmė.
  const handleSelectOrder = (id: number) => {
    setOrderId(id);
    const order = availableOrders.find((o) => o.uzsakymo_id === id);
    if (order) setTotal(Number(order.bendra_kaina));
  };

  const handleSubmit = async () => {
    if (!orderId) {
      alert("Pasirinkite užsakymą.");
      return;
    }
    try {
      await createInvoice({
        invoiceCreate: {
          order_id: Number(orderId),
          total,
          invoice_date: date,
        },
      }).unwrap();
      await onCreated();
      setOpen(false);
      alert("Sąskaita sėkmingai išrašyta!");
    } catch (err) {
      // formatApiError, NE fiksuotas tekstas - backend'as gali grąžinti KONKREČIĄ, veiksmingą priežastį (pvz. "Šis užsakymas jau turi sąskaitą", kai dvi sesijos išrašo vienu metu), kurią staff turi pamatyti, ne bendrą "klaida" pranešimą.
      alert(formatApiError(err, "Klaida išrašant sąskaitą."));
      console.error(err);
    }
  };

  return (
    <>
      <button
        className="bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        onClick={handleOpen}
      >
        + Nauja sąskaita
      </button>

      {open && (
        <BaseModal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Nauja sąskaita"
          actions={
            <>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-sm bg-[#1A2238] border border-[#1C2B3A] text-[#8899AA] hover:text-[#F7F7F7] transition"
              >
                Atšaukti
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !orderId}
                className="px-4 py-2 rounded-lg text-sm bg-[#0F597B] text-white font-medium hover:bg-[#0C4A66] transition disabled:opacity-50"
              >
                Išrašyti
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#F7F7F7]">
                Užsakymas<span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={orderId}
                onChange={(e) => handleSelectOrder(Number(e.target.value))}
                className={inputClass}
              >
                <option value="" disabled hidden>
                  — Pasirinkite —
                </option>
                {availableOrders.map((o) => (
                  <option key={o.uzsakymo_id} value={o.uzsakymo_id}>
                    #{o.uzsakymo_id} — {getClientName(o.kliento_id)} — {getCarName(o.automobilio_id)} ({o.bendra_kaina} €)
                  </option>
                ))}
              </select>
              {availableOrders.length === 0 && (
                <p className="text-xs text-[#8899AA] mt-1">
                  Visi užsakymai jau turi sąskaitas.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#F7F7F7]">Suma (€)</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#F7F7F7]">Sąskaitos data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}
