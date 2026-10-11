import React, { useEffect, useState, useMemo } from "react";
import { FiChevronLeft, FiChevronRight, FiChevronUp, FiChevronDown } from "react-icons/fi";

export type Column<T> = {
  label: string;
  // "| string" (ne TIK "keyof T") - visi šio projekto puslapiai apibrėžia "columns" masyvą BE aiškios ": Column<T>[]" anotacijos, tad TypeScript jų string accessor'ius (pvz. "el_pastas") infera kaip PLATŲ "string", ne siaurą literalą; be šio "| string" tokie (realūs, teisingi) accessor'iai nebeatitiktų tipo. Kiekvienas realus accessor VISADA yra tikras T lauko vardas - tai pasitikima pačiais puslapiais, ne priverstinai tikrinama čia.
  accessor: keyof T | string | ((row: T) => React.ReactNode);
  className?: string;
  // Reikalinga rūšiavimui, kai accessor yra funkcija (grąžina React elementą, kurio tiesiogiai palyginti negalima) - pvz. formatuotai kainai ar datai.
  sortValue?: (row: T) => string | number | Date | null | undefined;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  itemsPerPage?: number;
};

// Reikšmė, pagal kurią lyginama rūšiuojant - "sortValue" turi pirmenybę (žr. komentarą aukščiau), kitaip imama TIESIOG lauko reikšmė, nebent accessor yra funkcija be "sortValue" (tada rūšiavimas tai eilutei neleidžiamas, žr. isSortable žemiau, tad čia tiesiog grąžinama undefined).
function getSortValue<T>(col: Column<T>, row: T): string | number | Date | null | undefined {
  if (col.sortValue) return col.sortValue(row);
  if (typeof col.accessor === "function") return undefined;
  return row[col.accessor as keyof T] as unknown as string | number | Date;
}

// Bendra lentelė su rūšiavimu ir puslapiavimu - naudojama VISUOSE darbuotojų CRUD puslapiuose (clients/employees/fleet/invoices/orders/reservations/dashboard).
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Stulpelis rūšiuojamas, jei accessor yra TIESIOG lauko vardas (visada palyginamas), arba jei funkcinis accessor'ius turi papildomą "sortValue" - grynos funkcijos be jo negalima rūšiuoti, nes jos grąžina React elementą, kurio tiesiogiai palyginti negalima.
  const isSortable = (col: Column<T>) => typeof col.accessor !== "function" || !!col.sortValue;

  const handleSort = (index: number) => {
    const col = columns[index];
    if (!isSortable(col)) return;
    if (sortIndex === index) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortIndex(index);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // Nulinis (null/undefined) reikšmes VISADA stumia į sąrašo galą, nepriklausomai nuo rūšiavimo tvarkos - kitaip jos "šokinėtų" tarp pradžios/galo kaskart pakeičiant kryptį, kas atrodytų netvarkingai.
  const sortedData = useMemo(() => {
    if (sortIndex === null) return data;
    const col = columns[sortIndex];
    const withValues = data.map((row) => ({ row, value: getSortValue(col, row) }));
    withValues.sort((a, b) => {
      if (a.value == null && b.value == null) return 0;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      let cmp: number;
      if (a.value instanceof Date || b.value instanceof Date) {
        cmp = new Date(a.value).getTime() - new Date(b.value).getTime();
      } else if (typeof a.value === "number" && typeof b.value === "number") {
        cmp = a.value - b.value;
      } else {
        cmp = String(a.value).localeCompare(String(b.value), "lt");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withValues.map((w) => w.row);
  }, [data, sortIndex, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));

  // "currentPage" yra VIDINĖ šio komponento būsena, tad NIEKAS automatiškai nepastebi, kai tėvas pakeičia "data" (pvz. paieškos/filtro laukelis virš lentelės sumažina rezultatų skaičių) ir "totalPages" nukrenta ŽEMIAU dabartinio puslapio - be šio efekto "paginatedData" žemiau tiesiog nukirstų TUŠTUMĄ (slice() už masyvo galo), rodydama "Įrašų nerasta", nors realių atitikmenų yra, tiesiog ankstesniame puslapyje.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [currentPage, sortedData, itemsPerPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // Puslapių mygtukų sąrašas su "…" tarpais, kai puslapių daug - rodo PIRMĄ, PASKUTINĮ IR ±1 aplink dabartinį, be galo ilgo sąrašo didelėms lentelėms.
  const pageNumbers = useMemo(() => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("…");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++)
        pages.push(i);
      if (currentPage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1C2B3A] bg-[#0E1525]">
      <table className="min-w-full divide-y divide-[#1C2B3A]">
        <thead>
          <tr className="bg-[#0F597B]/15">
            {columns.map((col, i) => {
              const sortable = isSortable(col);
              return (
                <th
                  key={i}
                  onClick={sortable ? () => handleSort(i) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-[#4BAFD4] uppercase tracking-wider ${sortable ? "cursor-pointer select-none hover:text-[#6CC4EE]" : ""} ${col.className ?? ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && (
                      <span className="inline-flex flex-col -space-y-1 text-[10px]">
                        <FiChevronUp className={sortIndex === i && sortDir === "asc" ? "text-[#4BAFD4]" : "text-[#3D4F63]"} />
                        <FiChevronDown className={sortIndex === i && sortDir === "desc" ? "text-[#4BAFD4]" : "text-[#3D4F63]"} />
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1C2B3A]">
          {paginatedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[#3D4F63] text-sm">
                Įrašų nerasta
              </td>
            </tr>
          ) : (
            paginatedData.map((row, ri) => (
              <tr
                key={rowKey(row)}
                className={`transition-colors hover:bg-[#1A2238] ${ri % 2 === 1 ? "bg-[#0E1525]" : "bg-[#0a1020]"}`}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3.5 text-sm text-[#C8D8E8] align-middle ${col.className ?? ""}`}
                  >
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : (row[col.accessor as keyof T] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1C2B3A]">
          <span className="text-xs text-[#3D4F63]">
            {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, data.length)} iš {data.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <FiChevronLeft />
            </button>
            {pageNumbers.map((p, i) =>
              p === "…" ? (
                <span key={i} className="px-2 text-[#3D4F63] text-sm">…</span>
              ) : (
                <button
                  key={i}
                  onClick={() => goToPage(p as number)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                    currentPage === p
                      ? "bg-[#0F597B] text-white"
                      : "text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7]"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
