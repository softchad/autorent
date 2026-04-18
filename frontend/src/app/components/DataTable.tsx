import React, { useState, useMemo } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export type Column<T> = {
  label: string;
  accessor: keyof T | string | ((row: T) => React.ReactNode);
  className?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  itemsPerPage?: number;
};

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [currentPage, data, itemsPerPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

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
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-left text-xs font-semibold text-[#4BAFD4] uppercase tracking-wider ${col.className ?? ""}`}
              >
                {col.label}
              </th>
            ))}
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
