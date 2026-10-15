"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useInvoicesData } from "@/hooks/useInvoicesData";
import { useOrdersData } from "@/hooks/useOrdersData";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import StatusBadge from "@/app/components/StatusBadge";
import EntityModal from "@/app/components/staff/EntityModal";
import CreateInvoiceButton from "@/app/components/staff/CreateInvoiceButton";
import type { InvoiceOut, OrderOut } from "@/store/autorentApi";
import { useCreateInvoiceMutation, useDeleteInvoiceMutation, useGetAllOrdersQuery, useGetCurrentUserQuery } from "@/store/autorentApi";
import { FiRefreshCw, FiClipboard } from "react-icons/fi";
import { formatApiError } from "@/utils/formatApiError";

// PDF peržiūra/atsisiuntimas SĄMONINGAI pasiekiamas TIK darbuotojams (čia), ne klientui per /paskyra - kol sistema neturi realaus mokėjimų apdorojimo (žr. privatumo-politika puslapio 1 skyrių), sąskaita yra VIDINIS apskaitos įrašas, ne klientui patvirtintas apmokėjimo dokumentas, tad jos nerodyti klientui laikoma saugesniu pasirinkimu.
// PDF biblioteka neveikia SSR — kraunama tik kliente
const InvoicePdfModal = dynamic(
  () => import("@/app/components/staff/InvoicePdfModal"),
  { ssr: false }
);
const InvoiceDownloadButton = dynamic(
  () => import("@/app/components/staff/InvoiceDownloadButton"),
  { ssr: false }
);

// Tipas IŠVEDAMAS iš paties hook'o grąžinamos reikšmės (ne importuojamas iš atskiro schemos failo) - jei useInvoicesData.ts pakeistų "invoices" lauko formą, šis tipas AUTOMATIŠKAI atsinaujintų.
type Saskaita = NonNullable<
  ReturnType<typeof useInvoicesData>["invoices"]
>[number];

// Sąskaitų administravimas (sąrašas/paieška/statuso filtras/PDF/pergeneravimas). SVARBU: sąskaitos "status" NĖRA atskiras mokėjimo laukas - tai TIESIOG susieto užsakymo "uzsakymo_busena" (žr. backend endpoints/invoice.py JOIN) - sistema šiuo metu neturi atskiro mokėjimo sekimo (žr. privatumo-politika puslapio 1 skyrių).
export default function InvoicesPage() {
  const { data: currentUser } = useGetCurrentUserQuery();
  // Sąskaitos "pergeneravimas" žemiau viduje kviečia deleteInvoice, kuris backend'e reikalauja Perm.ADMIN (žr. invoice.py) - be šios patikros bet kuris EDIT teisę turintis darbuotojas matytų mygtuką, kurį paspaudus serveris atmestų su 403 (žr. formatApiError catch žemiau - klaida vis tiek apdorota saugiai, bet mygtukas neturėtų net rodytis).
  const isAdmin = currentUser?.pareigos === "Administratorius";

  const {
    invoices,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered,
    isLoading,
    refetch,
  } = useInvoicesData();

  const [createInvoice] = useCreateInvoiceMutation();
  const [deleteInvoice] = useDeleteInvoiceMutation();
  const { data: orders = [] } = useGetAllOrdersQuery();
  const { orderFields, getClientName, getCarName } = useOrdersData();

  const [pdfInvoice, setPdfInvoice] = useState<InvoiceOut | null>(null);
  const [orderModalOrder, setOrderModalOrder] = useState<OrderOut | null>(null);

  // Bendra PDF/atsisiuntimo komponentams reikalinga info apie SUSIJUSĮ užsakymą (automobilio pavadinimas, nuomos/grąžinimo datos) - viena funkcija, naudojama VISŲ TRIJŲ vietų žemiau (lentelės eilutėje, atsisiuntimo mygtuke, PDF lange), kad paieškos/formatavimo logika nebūtų kartojama tris kartus.
  const getOrderInfo = (orderId: number) => {
    const o = orders.find((ord) => ord.uzsakymo_id === orderId);
    return o
      ? { carName: getCarName(o.automobilio_id), nuomos_data: String(o.nuomos_data), grazinimo_data: String(o.grazinimo_data) }
      : undefined;
  };

  // Lentelės stulpelių aprašas DataTable'ui.
  const columns = [
    { label: "Sąskaitos nr.", accessor: "invoice_id" },
    {
      label: "Klientas",
      accessor: (s: Saskaita) => `${s.client_first_name} ${s.client_last_name}`,
    },
    {
      label: "Suma",
      // Rodoma BE ".toFixed(2)" - tas pats raštas naudojamas IR viešose kainos rodyklėse (nuoseklumo dėlei).
      accessor: (s: Saskaita) => `${s.total} €`,
    },
    {
      label: "Data",
      accessor: (s: Saskaita) =>
        new Date(s.invoice_date).toLocaleDateString("lt-LT"),
    },
    {
      // Realiai rodo SUSIETO UŽSAKYMO būseną (laukiama/patvirtinta/vykdoma/užbaigta/atšaukta), NE mokėjimo būseną - sistema jos atskirai neseka.
      label: "Būsena",
      accessor: (s: Saskaita) => <StatusBadge status={s.status} />,
    },
    {
      label: "Veiksmai",
      // "s" čia yra TOS KONKREČIOS eilutės sąskaita, uždaryta (closure) šiai vienai stulpelio funkcijai.
      accessor: (s: Saskaita) => (
        <div className="flex items-center gap-1">
          <button
            title="Užsakymo informacija"
            onClick={() => {
              const order = orders.find((o) => o.uzsakymo_id === s.order_id);
              if (order) setOrderModalOrder(order);
            }}
            className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-purple-900/30 hover:text-purple-400"
            aria-label="Užsakymo informacija"
          >
            <FiClipboard />
          </button>
          {isAdmin && (
            <button
              title="Pergeneruoti sąskaitą"
              onClick={async () => {
                if (!window.confirm(`Pergeneruoti sąskaitą nr. ${s.invoice_id}? Esama sąskaita bus ištrinta ir sukurta nauja.`)) return;
                try {
                  // RIZIKA: šie du veiksmai NĖRA atomiški (backend neturi vieno "regenerate" endpoint'o) - jei deleteInvoice pavyksta, bet createInvoice žemiau nepavyktų (pvz. tinklo klaida), sąskaita būtų IŠTRINTA be pakaitalo. Backend'as TAIP PAT neleidžia dviejų sąskaitų tam pačiam užsakymui (409), tad "sukurti naują PRIEŠ trinant seną" nėra alternatyva.
                  await deleteInvoice({ invoiceId: s.invoice_id }).unwrap();
                  await createInvoice({
                    invoiceCreate: {
                      order_id: s.order_id,
                      total: s.total,
                      invoice_date: new Date().toISOString().slice(0, 10),
                    },
                  }).unwrap();
                  await refetch();
                  alert("Sąskaita sėkmingai pergeneruota!");
                } catch (err) {
                  alert(formatApiError(err, "Klaida pergeneruojant sąskaitą."));
                }
              }}
              className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-amber-900/30 hover:text-amber-400"
              aria-label="Pergeneruoti"
            >
              <FiRefreshCw />
            </button>
          )}
          <ActionButtons
            onView={() => setPdfInvoice(s)}
            show={{ view: true, edit: false, delete: false }}
          />
          <InvoiceDownloadButton
            invoice={s}
            orderInfo={getOrderInfo(s.order_id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Sąskaitos</h1>
        <CreateInvoiceButton
          orders={orders}
          invoices={invoices}
          getClientName={getClientName}
          getCarName={getCarName}
          onCreated={() => {
            refetch();
          }}
        />
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[#707070]">
        <input
          type="text"
          placeholder="Ieškoti pagal klientą ar sąskaitos nr."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        {/* Reikšmės TIKSLIAI sutampa su backend'o VALID_BUSENA (schemas/order.py) - sąskaitos "status" yra užsakymo busena (žr. komentarą virš InvoicesPage aukščiau), tad filtras turi naudoti TAS PAČIAS 5 reikšmes, kitaip jis niekada neatitiktų jokios realios sąskaitos. */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="visi">Visos</option>
          <option value="laukiama">Laukiama</option>
          <option value="patvirtinta">Patvirtinta</option>
          <option value="vykdoma">Vykdoma</option>
          <option value="užbaigta">Užbaigta</option>
          <option value="atšaukta">Atšaukta</option>
        </select>
      </div>

      {isLoading ? (
        <p>Įkeliama...</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(s) => s.invoice_id}
        />
      )}

      {pdfInvoice && (
        <InvoicePdfModal
          invoice={pdfInvoice}
          orderInfo={getOrderInfo(pdfInvoice.order_id)}
          onClose={() => setPdfInvoice(null)}
        />
      )}

      {orderModalOrder && (
        <EntityModal
          title={`Užsakymas #${orderModalOrder.uzsakymo_id}`}
          entity={orderModalOrder}
          fields={orderFields}
          isOpen={!!orderModalOrder}
          onClose={() => setOrderModalOrder(null)}
        />
      )}
    </div>
  );
}
